import { ServiceUnavailableException } from '@nestjs/common';
import { GpuMetricsService } from './gpu-metrics.service';

describe('GpuMetricsService', () => {
  const originalMode = process.env.GPU_METRICS_MODE;

  afterEach(() => {
    if (originalMode === undefined) delete process.env.GPU_METRICS_MODE;
    else process.env.GPU_METRICS_MODE = originalMode;
    jest.restoreAllMocks();
  });

  it('parses real nvidia-smi telemetry and computes cluster totals', () => {
    process.env.GPU_METRICS_MODE = 'real';
    const service = new GpuMetricsService();
    jest.spyOn(service as any, 'queryNvidiaSmi').mockReturnValue([
      {
        id: 'GPU-abc',
        name: 'gpu-0',
        type: 'NVIDIA H100 80GB HBM3',
        utilizationPct: 92,
        memoryUsedGb: 40,
        memoryTotalGb: 80,
        temperatureC: 74,
        powerWatts: 525,
        powerLimitWatts: 700,
        smClockMhz: 1830,
        status: 'active',
      },
    ]);

    const metrics = service.getClusterMetrics();

    expect(metrics.source).toBe('nvidia-smi');
    expect(metrics.totalGpus).toBe(1);
    expect(metrics.activeGpus).toBe(1);
    expect(metrics.usedMemoryGb).toBe(40);
    expect(metrics.totalPowerKw).toBe(0.53);
    expect(metrics.warning).toBeUndefined();
  });

  it('returns an explicit deterministic mock in mock mode', () => {
    process.env.GPU_METRICS_MODE = 'mock';
    const metrics = new GpuMetricsService().getClusterMetrics();

    expect(metrics.source).toBe('mock');
    expect(metrics.warning).toContain('GPU_METRICS_MODE=mock');
    expect(metrics.totalGpus).toBe(20);
    expect(metrics.activeGpus).toBe(12);
    expect(metrics.nodes[0].id).toBe('mock-gpu-0');
  });

  it('fails closed when real telemetry is required but unavailable', () => {
    process.env.GPU_METRICS_MODE = 'real';
    const service = new GpuMetricsService();
    jest.spyOn(service as any, 'queryNvidiaSmi').mockImplementation(() => {
      throw new Error('command not found');
    });

    expect(() => service.getClusterMetrics()).toThrow(
      ServiceUnavailableException,
    );
  });

  it('rejects invalid telemetry modes', () => {
    process.env.GPU_METRICS_MODE = 'random';
    expect(() => new GpuMetricsService().getClusterMetrics()).toThrow(
      'GPU_METRICS_MODE must be one of: auto, real, mock',
    );
  });

  it('tags the node running a registered job pid with the job id', () => {
    process.env.GPU_METRICS_MODE = 'real';
    const service = new GpuMetricsService();
    const freshNode = () => [
      {
        id: 'GPU-abc',
        name: 'gpu-0',
        type: 'NVIDIA A100 80GB',
        utilizationPct: 91,
        memoryUsedGb: 60,
        memoryTotalGb: 80,
        temperatureC: 70,
        powerWatts: 380,
        powerLimitWatts: 400,
        smClockMhz: 1900,
        status: 'active' as const,
      },
    ];
    jest
      .spyOn(service as any, 'queryNvidiaSmi')
      .mockImplementation(freshNode);
    jest
      .spyOn(service as any, 'queryComputeAppGpus')
      .mockReturnValue(new Map([[4242, 'GPU-abc']]));

    service.registerActiveJob('job-1', 4242);
    const metrics = service.getClusterMetrics();

    expect(metrics.nodes[0].jobId).toBe('job-1');

    service.unregisterActiveJob('job-1');
    const after = service.getClusterMetrics();
    expect(after.nodes[0].jobId).toBeUndefined();
  });

  it('samples real utilization/memory for a registered job', () => {
    process.env.GPU_METRICS_MODE = 'real';
    const service = new GpuMetricsService();
    jest.spyOn(service as any, 'queryNvidiaSmi').mockReturnValue([
      {
        id: 'GPU-xyz',
        name: 'gpu-1',
        type: 'NVIDIA H100 80GB',
        utilizationPct: 97,
        memoryUsedGb: 55,
        memoryTotalGb: 80,
        temperatureC: 76,
        powerWatts: 600,
        powerLimitWatts: 700,
        smClockMhz: 1830,
        status: 'active',
      },
    ]);
    jest
      .spyOn(service as any, 'queryComputeAppGpus')
      .mockReturnValue(new Map([[777, 'GPU-xyz']]));

    service.registerActiveJob('job-2', 777);
    const sample = service.sampleJobGpuUsage('job-2');

    expect(sample).toEqual({ utilPct: [97], memUsedGb: [55] });
  });

  it('returns null when sampling for an unregistered job or in mock mode', () => {
    process.env.GPU_METRICS_MODE = 'real';
    const real = new GpuMetricsService();
    expect(real.sampleJobGpuUsage('unknown-job')).toBeNull();

    process.env.GPU_METRICS_MODE = 'mock';
    const mock = new GpuMetricsService();
    mock.registerActiveJob('job-3', 123);
    expect(mock.sampleJobGpuUsage('job-3')).toBeNull();
  });
});
