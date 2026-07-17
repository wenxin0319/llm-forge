import { Injectable } from '@nestjs/common';
import { ChildProcess, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { TrainingJob } from './job.entity';

export interface TrainingProcessCallbacks {
  onLog(line: string): void;
  onExit(code: number | null, signal: NodeJS.Signals | null): void;
  onError(error: Error): void;
}

interface RunnerConfig {
  method?: string;
  epochs?: number;
  learningRate?: number;
  batchSize?: number;
  loraRank?: number;
  maxSeqLength?: number;
  useFlashAttention?: boolean;
  useGradientCheckpointing?: boolean;
}

@Injectable()
export class TrainingProcessRunner {
  private readonly processes = new Map<string, ChildProcess>();

  isEnabled(): boolean {
    return process.env.TRAINING_EXECUTION_MODE === 'local';
  }

  start(job: TrainingJob, callbacks: TrainingProcessCallbacks): string {
    if (!this.isEnabled())
      throw new Error('TRAINING_EXECUTION_MODE is not local');
    if (this.processes.has(job.id))
      throw new Error(`job ${job.id} is already running`);
    if (!job.modelSource)
      throw new Error('job has no allowlisted model source');

    const config = job.config as RunnerConfig;
    const allowedMethods = ['full_fine_tune', 'lora', 'qlora', 'prefix_tuning'];
    if (!config.method || !allowedMethods.includes(config.method)) {
      throw new Error(
        `unsupported training method: ${config.method || 'missing'}`,
      );
    }

    const projectRoot = resolve(process.cwd());
    const dataRoot = resolve(
      process.env.TRAINING_DATA_ROOT || resolve(projectRoot, 'uploads'),
    );
    const datasetPath = resolve(projectRoot, job.datasetPath);
    if (!datasetPath.startsWith(`${dataRoot}${sep}`)) {
      throw new Error(
        `dataset path is outside TRAINING_DATA_ROOT: ${datasetPath}`,
      );
    }

    const outputRoot = resolve(
      process.env.TRAINING_OUTPUT_ROOT ||
        resolve(projectRoot, 'ml-tools/train/out/jobs'),
    );
    const outputPath = resolve(outputRoot, job.id);
    if (!outputPath.startsWith(`${outputRoot}${sep}`))
      throw new Error('invalid output path');
    mkdirSync(outputPath, { recursive: true });

    const script = resolve(projectRoot, 'ml-tools/train/sft_train.py');
    const args = [
      script,
      '--model',
      job.modelSource,
      '--dataset',
      datasetPath,
      '--method',
      String(config.method),
      '--output-dir',
      outputPath,
      '--epochs',
      String(config.epochs ?? 3),
      '--learning-rate',
      String(config.learningRate ?? 2e-4),
      '--batch-size',
      String(config.batchSize ?? 8),
      '--lora-rank',
      String(config.loraRank ?? 16),
      '--max-seq-length',
      String(config.maxSeqLength ?? 1024),
    ];
    if (config.useFlashAttention) args.push('--use-flash-attention');
    if (config.useGradientCheckpointing)
      args.push('--use-gradient-checkpointing');

    const executable = process.env.TRAINING_PYTHON_EXECUTABLE || 'python3';
    const child = spawn(executable, args, {
      cwd: resolve(projectRoot, 'ml-tools/train'),
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    this.processes.set(job.id, child);

    const forward = (prefix: string, chunk: Buffer) => {
      chunk
        .toString('utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => callbacks.onLog(`${prefix}${line}`));
    };
    child.stdout?.on('data', (chunk: Buffer) => forward('', chunk));
    child.stderr?.on('data', (chunk: Buffer) => forward('[stderr] ', chunk));
    child.on('error', (error) => {
      this.processes.delete(job.id);
      callbacks.onError(error);
    });
    child.on('exit', (code, signal) => {
      this.processes.delete(job.id);
      callbacks.onExit(code, signal);
    });

    return outputPath;
  }

  cancel(jobId: string): boolean {
    const child = this.processes.get(jobId);
    if (!child) return false;
    return child.kill('SIGTERM');
  }
}
