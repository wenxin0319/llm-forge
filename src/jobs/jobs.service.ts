import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ArtifactsService } from '../artifacts/artifacts.service';

export type JobStatus = 'queued' | 'preprocessing' | 'training' | 'packaging' | 'completed' | 'failed' | 'cancelled';

export interface MetricPoint {
  step: number;
  epoch: number;
  trainLoss: number;
  valLoss: number;
  learningRate: number;
  tokensPerSec: number;
}

export interface TrainingJob {
  id: string;
  ownerId: string;
  modelId: string;
  modelName: string;
  baseModelId?: string;
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
  metrics: MetricPoint[];
  logs: string[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

@Injectable()
export class JobsService {
  private readonly jobs = new Map<string, TrainingJob>();

  constructor(
    @Inject(forwardRef(() => ArtifactsService))
    private readonly artifactsService: ArtifactsService,
  ) {}

  create(ownerId: string, data: Omit<TrainingJob, 'id' | 'ownerId' | 'status' | 'progress' | 'currentEpoch' | 'totalEpochs' | 'logs' | 'metrics' | 'createdAt'>): TrainingJob {
    const job: TrainingJob = {
      id: uuidv4(),
      ownerId,
      status: 'queued',
      progress: 0,
      currentEpoch: 0,
      totalEpochs: (data.config as any)?.epochs || 3,
      logs: ['[00:00] Job queued, waiting for GPU allocation...'],
      metrics: [],
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

    // Preprocessing stage
    setTimeout(() => {
      job.status = 'preprocessing';
      job.logs.push('[00:15] Preprocessing dataset — tokenizing and splitting train/val...');
    }, 1500);

    setTimeout(() => {
      job.logs.push('[00:45] Dataset preprocessed. Train: 42,847 rows | Val: 4,761 rows');
      job.logs.push('[00:50] Downloading base model weights from HuggingFace Hub...');
    }, 3000);

    // Training stage
    setTimeout(() => {
      job.status = 'training';
      job.startedAt = new Date();
      job.logs.push('[01:20] Base model loaded. Initializing QLoRA adapters (rank=16)...');
      job.logs.push('[01:25] Flash Attention 2.0 enabled. Gradient checkpointing active.');
      job.logs.push('[01:30] Training started. Parallel data loading active (4 workers).');
    }, 5000);

    const epochInterval = 6000;
    for (let epoch = 1; epoch <= job.totalEpochs; epoch++) {
      const stepsPerEpoch = 12;
      for (let step = 1; step <= stepsPerEpoch; step++) {
        setTimeout(() => {
          const globalStep = (epoch - 1) * stepsPerEpoch + step;
          const trainLoss = parseFloat((2.4 - (globalStep / (job.totalEpochs * stepsPerEpoch)) * 1.6 + (Math.random() - 0.5) * 0.06).toFixed(4));
          const valLoss = parseFloat((trainLoss + 0.08 + Math.random() * 0.03).toFixed(4));
          const lr = parseFloat((2e-4 * (1 - globalStep / (job.totalEpochs * stepsPerEpoch) * 0.3)).toExponential(2));
          const tps = Math.round(1800 + Math.random() * 400);

          const point: MetricPoint = { step: globalStep, epoch, trainLoss, valLoss, learningRate: lr, tokensPerSec: tps };
          job.metrics.push(point);
          job.trainLoss = trainLoss;
          job.valLoss = valLoss;

          if (step === stepsPerEpoch) {
            job.currentEpoch = epoch;
            job.progress = Math.round((epoch / job.totalEpochs) * 85);
            job.logs.push(`[epoch ${epoch}/${job.totalEpochs}] train_loss=${trainLoss} val_loss=${valLoss} lr=${lr} tok/s=${tps}`);
          }
        }, 5000 + (epoch - 1) * epochInterval + (step / stepsPerEpoch) * epochInterval);
      }
    }

    // Packaging stage
    setTimeout(() => {
      job.status = 'packaging';
      job.progress = 90;
      job.logs.push('[packaging] Training complete. Merging LoRA adapters into base model...');
      job.logs.push('[packaging] Running GGUF quantization (Q4_K_M)...');
    }, 5000 + job.totalEpochs * epochInterval + 500);

    // Completed
    setTimeout(() => {
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      job.actualCostUsd = parseFloat((job.estimatedCostUsd * (0.88 + Math.random() * 0.18)).toFixed(2));
      job.logs.push('[done] Adapter checkpoint saved (32 MB).');
      job.logs.push('[done] Merged FP16 model saved (4.7 GB).');
      job.logs.push('[done] GGUF Q4_K_M quantization complete (1.3 GB).');
      job.logs.push('[done] Model artifacts ready for download.');

      // Auto-create artifacts
      const outputFormat = (job.config as any)?.outputFormat || 'gguf';
      const baseModelId = job.baseModelId || 'llama-3.1-8b-instruct';
      this.artifactsService.createJobArtifacts(job.ownerId, job.id, job.modelName, baseModelId, outputFormat);
    }, 5000 + job.totalEpochs * epochInterval + 4000);
  }

  findAll(ownerId: string): TrainingJob[] {
    return [...this.jobs.values()]
      .filter((j) => j.ownerId === ownerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  findOne(id: string, ownerId: string): TrainingJob {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException('Job not found');
    if (job.ownerId !== ownerId) throw new ForbiddenException();
    return job;
  }

  getMetrics(id: string, ownerId: string): MetricPoint[] {
    return this.findOne(id, ownerId).metrics;
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
