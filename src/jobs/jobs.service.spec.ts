import { computePeakGpuMemGb, JobsService, MetricPoint } from './jobs.service';

describe('JobsService recovery on startup', () => {
  const find = jest.fn();
  const update = jest.fn().mockResolvedValue(undefined);
  const repo = { find, update } as any;
  const service = new JobsService(repo, {} as any, {} as any, {} as any);
  let killSpy: jest.SpyInstance;

  const baseJob = {
    id: 'job-1',
    status: 'training',
    processPid: null as number | null,
    startedAt: null as Date | null,
    estimatedHours: 0,
    estimatedCostUsd: 0,
    logs: ['[00:00] Job queued'],
  };

  beforeEach(() => {
    find.mockReset();
    update.mockReset().mockResolvedValue(undefined);
    killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true as never);
  });

  afterEach(() => {
    killSpy.mockRestore();
  });

  it('does nothing when no job is stuck in a non-terminal status', async () => {
    find.mockResolvedValue([]);
    await service.onModuleInit();
    expect(update).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('marks a stuck job with no recorded pid as failed without touching any process', async () => {
    find.mockResolvedValue([{ ...baseJob }]);
    await service.onModuleInit();

    expect(killSpy).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        status: 'failed',
        logs: expect.arrayContaining([
          expect.stringContaining('interrupted by a backend restart'),
        ]),
      }),
    );
  });

  it('sends SIGTERM to a still-alive orphaned process before failing the job', async () => {
    find.mockResolvedValue([{ ...baseJob, processPid: 4242 }]);
    await service.onModuleInit();

    expect(killSpy).toHaveBeenCalledWith(4242, 'SIGTERM');
    expect(update).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('tolerates a recorded pid that has already exited', async () => {
    killSpy.mockImplementation(() => {
      throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
    });
    find.mockResolvedValue([{ ...baseJob, processPid: 4242 }]);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('computes elapsed training time and cost from startedAt/estimated rate', async () => {
    const startedAt = new Date(Date.now() - 3600_000); // 1 hour ago
    find.mockResolvedValue([
      { ...baseJob, startedAt, estimatedHours: 2, estimatedCostUsd: 4 },
    ]);

    await service.onModuleInit();

    const [, fields] = update.mock.calls[0];
    expect(fields.totalTrainingSec).toBeGreaterThanOrEqual(3599);
    expect(fields.totalTrainingSec).toBeLessThanOrEqual(3601);
    // estimated rate is $2/hr; ~1 hour elapsed -> ~$2
    expect(fields.actualCostUsd).toBeGreaterThan(1.9);
    expect(fields.actualCostUsd).toBeLessThan(2.1);
  });
});

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
