import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { execFileSync } from 'node:child_process';

export interface GpuNode {
  id: string;
  name: string;
  type: string;
  utilizationPct: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  temperatureC: number;
  powerWatts: number;
  powerLimitWatts: number;
  smClockMhz: number;
  nvlinkBandwidthGbps?: number;
  jobId?: string;
  status: 'idle' | 'active' | 'hot' | 'offline';
}

export interface ClusterMetrics {
  source: 'nvidia-smi' | 'mock';
  collectedAt: string;
  warning?: string;
  totalGpus: number;
  activeGpus: number;
  idleGpus: number;
  avgUtilizationPct: number;
  totalMemoryGb: number;
  usedMemoryGb: number;
  totalPowerKw: number;
  efficiencyScore: number;
  nodes: GpuNode[];
}

type MetricsMode = 'auto' | 'real' | 'mock';

const GPU_TEMPLATES = [
  { type: 'H100-SXM5-80GB', memTotal: 80, powerLimit: 700, smClock: 3350 },
  { type: 'A100-SXM4-80GB', memTotal: 80, powerLimit: 400, smClock: 1980 },
  { type: 'A100-SXM4-40GB', memTotal: 40, powerLimit: 400, smClock: 1980 },
];

const NVIDIA_SMI_FIELDS = [
  'index',
  'uuid',
  'name',
  'utilization.gpu',
  'memory.used',
  'memory.total',
  'temperature.gpu',
  'power.draw',
  'power.limit',
  'clocks.sm',
].join(',');

@Injectable()
export class GpuMetricsService {
  private readonly mockNodes: GpuNode[] = this.generateMockCluster();
  private lastNodes: GpuNode[] = [];
  private readonly activeJobPids = new Map<string, number>();

  /** Called by JobsService once it knows the PID of a locally spawned training process. */
  registerActiveJob(jobId: string, pid: number): void {
    this.activeJobPids.set(jobId, pid);
  }

  unregisterActiveJob(jobId: string): void {
    this.activeJobPids.delete(jobId);
  }

  /**
   * Real per-job GPU numbers for the currently registered job, sampled from
   * nvidia-smi at call time. Used to fill in the gpuUtilPct/gpuMemUsedGb
   * fields that the HF Trainer callback intentionally leaves empty (see
   * ml-tools/train/metrics_callback.py) since the training process itself
   * has no view of device-level telemetry.
   */
  sampleJobGpuUsage(
    jobId: string,
  ): { utilPct: number[]; memUsedGb: number[] } | null {
    if (this.getMode() === 'mock') return null;
    const pid = this.activeJobPids.get(jobId);
    if (!pid) return null;

    try {
      const nodes = this.queryNvidiaSmi();
      const pidToGpuUuid = this.queryComputeAppGpus();
      const gpuUuid = pidToGpuUuid.get(pid);
      if (!gpuUuid) return null;
      const node = nodes.find((n) => n.id === gpuUuid);
      if (!node) return null;
      return { utilPct: [node.utilizationPct], memUsedGb: [node.memoryUsedGb] };
    } catch {
      return null;
    }
  }

  getClusterMetrics(): ClusterMetrics {
    const mode = this.getMode();

    if (mode !== 'mock') {
      try {
        const nodes = this.queryNvidiaSmi();
        this.attachJobCorrelation(nodes);
        this.lastNodes = nodes;
        return this.summarize(nodes, 'nvidia-smi');
      } catch (error) {
        if (mode === 'real') {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new ServiceUnavailableException(
            `Real GPU telemetry unavailable: ${message}`,
          );
        }
      }
    }

    const nodes = this.updateMockCluster();
    this.lastNodes = nodes;
    return this.summarize(
      nodes,
      'mock',
      mode === 'auto'
        ? 'nvidia-smi unavailable; returning explicit demo telemetry'
        : 'GPU_METRICS_MODE=mock; returning explicit demo telemetry',
    );
  }

  getNodeById(id: string): GpuNode | undefined {
    if (this.lastNodes.length === 0) this.getClusterMetrics();
    return this.lastNodes.find((node) => node.id === id);
  }

  private getMode(): MetricsMode {
    const value = (process.env.GPU_METRICS_MODE || 'auto').toLowerCase();
    if (value === 'auto' || value === 'real' || value === 'mock') return value;
    throw new Error('GPU_METRICS_MODE must be one of: auto, real, mock');
  }

  private queryNvidiaSmi(): GpuNode[] {
    const output = execFileSync(
      'nvidia-smi',
      [`--query-gpu=${NVIDIA_SMI_FIELDS}`, '--format=csv,noheader,nounits'],
      { encoding: 'utf8', timeout: 5000 },
    );

    const nodes = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => this.parseNvidiaSmiLine(line));

    if (nodes.length === 0) throw new Error('nvidia-smi returned no GPUs');
    return nodes;
  }

  private parseNvidiaSmiLine(line: string): GpuNode {
    const fields = line.split(',').map((value) => value.trim());
    if (fields.length !== 10) {
      throw new Error(`unexpected nvidia-smi field count: ${fields.length}`);
    }

    const [
      index,
      uuid,
      name,
      utilization,
      memoryUsed,
      memoryTotal,
      temperature,
      power,
      powerLimit,
      smClock,
    ] = fields;
    const utilizationPct = this.number(utilization, 'utilization.gpu');
    const memoryUsedGb = this.mibToGib(this.number(memoryUsed, 'memory.used'));
    const memoryTotalGb = this.mibToGib(
      this.number(memoryTotal, 'memory.total'),
    );
    const temperatureC = this.number(temperature, 'temperature.gpu');
    const powerWatts = this.number(power, 'power.draw');
    const powerLimitWatts = this.number(powerLimit, 'power.limit');

    return {
      id: uuid || `gpu-${index}`,
      name: `gpu-${index}`,
      type: name,
      utilizationPct,
      memoryUsedGb,
      memoryTotalGb,
      temperatureC,
      powerWatts,
      powerLimitWatts,
      smClockMhz: this.number(smClock, 'clocks.sm'),
      status:
        temperatureC >= 80
          ? 'hot'
          : utilizationPct > 2 || memoryUsedGb > 1
            ? 'active'
            : 'idle',
    };
  }

  /** Maps process id -> GPU uuid for currently running CUDA compute processes. */
  private queryComputeAppGpus(): Map<number, string> {
    const map = new Map<number, string>();
    try {
      const output = execFileSync(
        'nvidia-smi',
        ['--query-compute-apps=pid,gpu_uuid', '--format=csv,noheader,nounits'],
        { encoding: 'utf8', timeout: 5000 },
      );
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          const [pidField, uuidField] = line.split(',').map((v) => v.trim());
          const pid = Number(pidField);
          if (Number.isFinite(pid) && uuidField) map.set(pid, uuidField);
        });
    } catch {
      // No compute processes, older driver, or nvidia-smi unavailable —
      // job correlation is best-effort and falls back to untagged nodes.
    }
    return map;
  }

  private attachJobCorrelation(nodes: GpuNode[]): void {
    if (this.activeJobPids.size === 0) return;
    const pidToGpuUuid = this.queryComputeAppGpus();
    for (const [jobId, pid] of this.activeJobPids) {
      const gpuUuid = pidToGpuUuid.get(pid);
      if (!gpuUuid) continue;
      const node = nodes.find((n) => n.id === gpuUuid);
      if (node) node.jobId = jobId;
    }
  }

  private number(value: string, field: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
      throw new Error(`invalid ${field} value: ${value}`);
    return parsed;
  }

  private mibToGib(value: number): number {
    return Number((value / 1024).toFixed(2));
  }

  private summarize(
    nodes: GpuNode[],
    source: ClusterMetrics['source'],
    warning?: string,
  ): ClusterMetrics {
    const activeNodes = nodes.filter(
      (node) => node.status === 'active' || node.status === 'hot',
    );
    const totalPowerW = nodes.reduce((sum, node) => sum + node.powerWatts, 0);
    const usedMemoryGb = nodes.reduce(
      (sum, node) => sum + node.memoryUsedGb,
      0,
    );
    const totalMemoryGb = nodes.reduce(
      (sum, node) => sum + node.memoryTotalGb,
      0,
    );
    const avgUtilizationPct = activeNodes.length
      ? activeNodes.reduce((sum, node) => sum + node.utilizationPct, 0) /
        activeNodes.length
      : 0;
    const memoryUtilization = totalMemoryGb ? usedMemoryGb / totalMemoryGb : 0;

    return {
      source,
      collectedAt: new Date().toISOString(),
      ...(warning ? { warning } : {}),
      totalGpus: nodes.length,
      activeGpus: activeNodes.length,
      idleGpus: nodes.length - activeNodes.length,
      avgUtilizationPct: Number(avgUtilizationPct.toFixed(1)),
      totalMemoryGb: Number(totalMemoryGb.toFixed(2)),
      usedMemoryGb: Number(usedMemoryGb.toFixed(2)),
      totalPowerKw: Number((totalPowerW / 1000).toFixed(2)),
      efficiencyScore: Number(
        (avgUtilizationPct * 0.9 + memoryUtilization * 10).toFixed(1),
      ),
      nodes: nodes.map((node) => ({ ...node })),
    };
  }

  private generateMockCluster(): GpuNode[] {
    const nodes: GpuNode[] = [];
    const counts = [4, 8, 8];
    const names = ['h100', 'a100-80', 'a100-40'];

    GPU_TEMPLATES.forEach((template, templateIndex) => {
      for (let index = 0; index < counts[templateIndex]; index++) {
        nodes.push({
          id: `mock-gpu-${nodes.length}`,
          name: `demo-${names[templateIndex]}-${index.toString().padStart(2, '0')}`,
          type: template.type,
          utilizationPct: 0,
          memoryUsedGb: 0,
          memoryTotalGb: template.memTotal,
          temperatureC: 35,
          powerWatts: templateIndex === 0 ? 80 : 60,
          powerLimitWatts: template.powerLimit,
          smClockMhz: template.smClock,
          status: 'idle',
        });
      }
    });
    return nodes;
  }

  private updateMockCluster(): GpuNode[] {
    return this.mockNodes.map((node, index) => {
      const active = index < 12;
      if (!active) {
        return {
          ...node,
          utilizationPct: 0,
          memoryUsedGb: 0,
          temperatureC: 35,
          status: 'idle',
        };
      }
      const utilizationPct = 84 + (index % 4) * 3;
      const memoryUsedGb = Number(
        (node.memoryTotalGb * (0.68 + (index % 3) * 0.06)).toFixed(1),
      );
      const temperatureC = 72 + (index % 5) * 2;
      return {
        ...node,
        utilizationPct,
        memoryUsedGb,
        temperatureC,
        powerWatts: Math.round(
          node.powerLimitWatts * (0.76 + (index % 3) * 0.06),
        ),
        status: temperatureC >= 80 ? 'hot' : 'active',
      };
    });
  }
}
