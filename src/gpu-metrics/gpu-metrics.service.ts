import { Injectable } from '@nestjs/common';

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

const GPU_TEMPLATES = [
  { type: 'H100-SXM5-80GB', memTotal: 80, powerLimit: 700, smClock: 3350 },
  { type: 'A100-SXM4-80GB', memTotal: 80, powerLimit: 400, smClock: 1980 },
  { type: 'A100-SXM4-40GB', memTotal: 40, powerLimit: 400, smClock: 1980 },
];

@Injectable()
export class GpuMetricsService {
  private readonly nodes: GpuNode[] = this.generateCluster();

  private generateCluster(): GpuNode[] {
    const nodes: GpuNode[] = [];
    let nodeIndex = 0;

    // 4x H100 nodes (high-end)
    for (let i = 0; i < 4; i++) {
      const tpl = GPU_TEMPLATES[0];
      nodes.push({
        id: `gpu-${nodeIndex++}`,
        name: `node-h100-${i.toString().padStart(2, '0')}`,
        type: tpl.type,
        utilizationPct: 0,
        memoryUsedGb: 0,
        memoryTotalGb: tpl.memTotal,
        temperatureC: 35,
        powerWatts: 80,
        powerLimitWatts: tpl.powerLimit,
        smClockMhz: tpl.smClock,
        nvlinkBandwidthGbps: 900,
        status: 'idle',
      });
    }

    // 8x A100-80GB nodes
    for (let i = 0; i < 8; i++) {
      const tpl = GPU_TEMPLATES[1];
      nodes.push({
        id: `gpu-${nodeIndex++}`,
        name: `node-a100-80-${i.toString().padStart(2, '0')}`,
        type: tpl.type,
        utilizationPct: 0,
        memoryUsedGb: 0,
        memoryTotalGb: tpl.memTotal,
        temperatureC: 35,
        powerWatts: 60,
        powerLimitWatts: tpl.powerLimit,
        smClockMhz: tpl.smClock,
        nvlinkBandwidthGbps: 600,
        status: 'idle',
      });
    }

    // 8x A100-40GB nodes
    for (let i = 0; i < 8; i++) {
      const tpl = GPU_TEMPLATES[2];
      nodes.push({
        id: `gpu-${nodeIndex++}`,
        name: `node-a100-40-${i.toString().padStart(2, '0')}`,
        type: tpl.type,
        utilizationPct: 0,
        memoryUsedGb: 0,
        memoryTotalGb: tpl.memTotal,
        temperatureC: 35,
        powerWatts: 60,
        powerLimitWatts: tpl.powerLimit,
        smClockMhz: tpl.smClock,
        status: 'idle',
      });
    }

    return nodes;
  }

  getClusterMetrics(): ClusterMetrics {
    // Simulate live metrics with some randomness
    this.nodes.forEach((node, i) => {
      const active = i < 12; // simulate 12 of 20 GPUs active
      if (active) {
        node.utilizationPct = Math.min(100, 78 + Math.random() * 18);
        node.memoryUsedGb = parseFloat((node.memoryTotalGb * (0.65 + Math.random() * 0.25)).toFixed(1));
        node.temperatureC = Math.round(72 + Math.random() * 12);
        node.powerWatts = Math.round(node.powerLimitWatts * (0.75 + Math.random() * 0.2));
        node.status = node.temperatureC > 80 ? 'hot' : 'active';
      } else {
        node.utilizationPct = Math.random() * 2;
        node.memoryUsedGb = parseFloat((Math.random() * 2).toFixed(1));
        node.temperatureC = Math.round(33 + Math.random() * 5);
        node.powerWatts = Math.round(60 + Math.random() * 20);
        node.status = 'idle';
      }
    });

    const activeNodes = this.nodes.filter((n) => n.status === 'active' || n.status === 'hot');
    const totalPowerW = this.nodes.reduce((s, n) => s + n.powerWatts, 0);
    const usedMem = this.nodes.reduce((s, n) => s + n.memoryUsedGb, 0);
    const totalMem = this.nodes.reduce((s, n) => s + n.memoryTotalGb, 0);
    const avgUtil = activeNodes.length > 0
      ? activeNodes.reduce((s, n) => s + n.utilizationPct, 0) / activeNodes.length
      : 0;

    return {
      totalGpus: this.nodes.length,
      activeGpus: activeNodes.length,
      idleGpus: this.nodes.length - activeNodes.length,
      avgUtilizationPct: parseFloat(avgUtil.toFixed(1)),
      totalMemoryGb: totalMem,
      usedMemoryGb: parseFloat(usedMem.toFixed(1)),
      totalPowerKw: parseFloat((totalPowerW / 1000).toFixed(2)),
      efficiencyScore: parseFloat((avgUtil * 0.9 + (usedMem / totalMem) * 10).toFixed(1)),
      nodes: this.nodes.map((n) => ({ ...n, utilizationPct: parseFloat(n.utilizationPct.toFixed(1)) })),
    };
  }

  getNodeById(id: string): GpuNode | undefined {
    return this.nodes.find((n) => n.id === id);
  }
}
