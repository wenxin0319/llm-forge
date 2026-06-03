import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export type JobStatus = 'queued' | 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TrainingJob {
  id: string;
  ownerId: string;
  modelId: string;
  modelName: string;
  datasetId: string;
  datasetName: string;
  config: object;
  status: JobStatus;
  gpuVramGb: number;
  gpuTflops: number;
  estimatedHours: number;
  estimatedCostUsd: number;
  actualCostUsd?: number;
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  trainLoss?: number;
  valLoss?: number;
  logs: string[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

@Injectable()
export class JobsService {
  private readonly jobs = new Map<string, TrainingJob>();

  create(ownerId: string, data: Omit<TrainingJob, 'id' | 'ownerId' | 'status' | 'progress' | 'currentEpoch' | 'totalEpochs' | 'logs' | 'createdAt'>): TrainingJob {
    const job: TrainingJob = {
      id: uuidv4(),
      ownerId,
      status: 'queued',
      progress: 0,
      currentEpoch: 0,
      totalEpochs: (data.config as any)?.epochs || 3,
      logs: ['[00:00] Job queued, waiting for GPU allocation...'],
      createdAt: new Date(),
      ...data,
    };
    this.jobs.set(job.id, job);
    this.simulateTraining(job.id);
    return job;
  }

  private simulateTraining(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    setTimeout(() => {
      job.status = 'initializing';
      job.logs.push('[00:30] Allocating GPUs and loading base model...');
    }, 1000);

    setTimeout(() => {
      job.status = 'running';
      job.startedAt = new Date();
      job.logs.push('[01:00] Training started. Parallel data loading active.');
      job.logs.push('[01:05] Flash Attention 2.0 enabled. Gradient checkpointing active.');
    }, 3000);

    const epochInterval = 5000;
    for (let epoch = 1; epoch <= job.totalEpochs; epoch++) {
      setTimeout(() => {
        job.currentEpoch = epoch;
        job.progress = Math.round((epoch / job.totalEpochs) * 100);
        job.trainLoss = parseFloat((2.1 - epoch * 0.4 + Math.random() * 0.05).toFixed(4));
        job.valLoss = parseFloat((job.trainLoss + 0.08 + Math.random() * 0.02).toFixed(4));
        job.logs.push(`[epoch ${epoch}] train_loss=${job.trainLoss} val_loss=${job.valLoss} lr=1.2e-4`);
      }, 3000 + epoch * epochInterval);
    }

    setTimeout(() => {
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      job.actualCostUsd = parseFloat((job.estimatedCostUsd * (0.9 + Math.random() * 0.2)).toFixed(2));
      job.logs.push('[done] Training complete. Model checkpoint saved. Running quantization...');
      job.logs.push('[done] Quantization complete. Model ready for deployment.');
    }, 3000 + (job.totalEpochs + 1) * epochInterval);
  }

  findAll(ownerId: string): TrainingJob[] {
    return [...this.jobs.values()].filter((j) => j.ownerId === ownerId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  findOne(id: string, ownerId: string): TrainingJob {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException('Job not found');
    if (job.ownerId !== ownerId) throw new ForbiddenException();
    return job;
  }

  cancel(id: string, ownerId: string) {
    const job = this.findOne(id, ownerId);
    if (['completed', 'failed', 'cancelled'].includes(job.status)) return job;
    job.status = 'cancelled';
    job.completedAt = new Date();
    job.logs.push('[cancelled] Job cancelled by user.');
    return job;
  }
}
