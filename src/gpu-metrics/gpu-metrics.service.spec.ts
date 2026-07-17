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
});
