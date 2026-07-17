import { TrainingJob } from './job.entity';
import { TrainingProcessRunner } from './training-process.runner';

describe('TrainingProcessRunner', () => {
  const originalMode = process.env.TRAINING_EXECUTION_MODE;
  const originalRoot = process.env.TRAINING_DATA_ROOT;

  afterEach(() => {
    if (originalMode === undefined) delete process.env.TRAINING_EXECUTION_MODE;
    else process.env.TRAINING_EXECUTION_MODE = originalMode;
    if (originalRoot === undefined) delete process.env.TRAINING_DATA_ROOT;
    else process.env.TRAINING_DATA_ROOT = originalRoot;
  });

  it('is disabled unless local execution is explicitly selected', () => {
    delete process.env.TRAINING_EXECUTION_MODE;
    expect(new TrainingProcessRunner().isEnabled()).toBe(false);
    process.env.TRAINING_EXECUTION_MODE = 'local';
    expect(new TrainingProcessRunner().isEnabled()).toBe(true);
  });

  it('rejects dataset paths outside the configured upload root before spawning', () => {
    process.env.TRAINING_EXECUTION_MODE = 'local';
    process.env.TRAINING_DATA_ROOT = '/safe/uploads';
    const runner = new TrainingProcessRunner();
    const job = {
      id: 'job-1',
      modelSource: 'Qwen/Qwen3-0.6B',
      datasetPath: '/etc/passwd',
      config: { method: 'qlora' },
    } as TrainingJob;

    expect(() =>
      runner.start(job, {
        onLog: () => undefined,
        onExit: () => undefined,
        onError: () => undefined,
      }),
    ).toThrow('dataset path is outside TRAINING_DATA_ROOT');
  });

  it('rejects methods outside the approved training-script choices', () => {
    process.env.TRAINING_EXECUTION_MODE = 'local';
    process.env.TRAINING_DATA_ROOT = '/safe/uploads';
    const runner = new TrainingProcessRunner();
    const job = {
      id: 'job-2',
      modelSource: 'Qwen/Qwen3-0.6B',
      datasetPath: '/safe/uploads/data.jsonl',
      config: { method: 'shell-command' },
    } as TrainingJob;

    expect(() =>
      runner.start(job, {
        onLog: () => undefined,
        onExit: () => undefined,
        onError: () => undefined,
      }),
    ).toThrow('unsupported training method');
  });
});
