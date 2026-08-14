import { computePeakGpuMemGb, MetricPoint } from './jobs.service';

describe('computePeakGpuMemGb', () => {
  const point = (gpuMemUsedGb: number[] | undefined): MetricPoint => ({
    step: 1,
    epoch: 1,
    timestampMs: 0,
    trainLoss: 0,
    valLoss: null,
    learningRate: null,
    tokensPerSec: null,
    stepsPerSec: null,
    gpuUtilPct: [],
    gpuMemUsedGb: gpuMemUsedGb as unknown as number[],
  });

  it('returns the max value across all points and GPUs, rounded to 1 decimal', () => {
    const metrics = [point([4.2, 4.8]), point([9.94]), point([1.1])];
    expect(computePeakGpuMemGb(metrics)).toBe(9.9);
  });

  it('returns null when no metric points carry GPU memory data', () => {
    expect(computePeakGpuMemGb([point(undefined), point([])])).toBeNull();
  });

  it('keeps a real zero reading instead of treating it as missing data', () => {
    expect(computePeakGpuMemGb([point([0])])).toBe(0);
  });
});
