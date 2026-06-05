import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrainingJob } from './job.entity';
import { ArtifactsService } from '../artifacts/artifacts.service';

export interface MetricPoint {
  step: number;
  epoch: number;
  trainLoss: number;
  valLoss: number;
  learningRate: number;
  tokensPerSec: number;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(TrainingJob)
    private readonly jobRepo: Repository<TrainingJob>,
    @Inject(forwardRef(() => ArtifactsService))
    private readonly artifactsService: ArtifactsService,
  ) {}

  async create(ownerId: string, data: Partial<TrainingJob>): Promise<TrainingJob> {
    const job = this.jobRepo.create({
      ownerId,
      status: 'queued',
      progress: 0,
      currentEpoch: 0,
      totalEpochs: (data.config as any)?.epochs || 3,
      logs: ['[00:00] Job queued, waiting for GPU allocation...'],
      metrics: [],
      ...data,
    });
    const saved = await this.jobRepo.save(job);
    this.simulateTraining(saved.id);
    return saved;
  }

  private async simulateTraining(jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;

    const update = (fields: Partial<TrainingJob>) =>
      this.jobRepo.update(jobId, fields);

    const pushLog = async (line: string) => {
      const j = await this.jobRepo.findOne({ where: { id: jobId } });
      if (j) await this.jobRepo.update(jobId, { logs: [...(j.logs as string[]), line] });
    };

    const pushMetric = async (point: MetricPoint) => {
      const j = await this.jobRepo.findOne({ where: { id: jobId } });
      if (j) await this.jobRepo.update(jobId, { metrics: [...(j.metrics as object[]), point] });
    };

    setTimeout(async () => {
      await update({ status: 'preprocessing' });
      await pushLog('[00:15] Preprocessing dataset — tokenizing and splitting train/val...');
    }, 1500);

    setTimeout(async () => {
      await pushLog('[00:45] Dataset preprocessed. Train: 42,847 rows | Val: 4,761 rows');
      await pushLog('[00:50] Downloading base model weights from HuggingFace Hub...');
    }, 3000);

    setTimeout(async () => {
      await update({ status: 'training', startedAt: new Date() });
      await pushLog('[01:20] Base model loaded. Initializing QLoRA adapters (rank=16)...');
      await pushLog('[01:25] Flash Attention 2.0 enabled. Gradient checkpointing active.');
      await pushLog('[01:30] Training started. Parallel data loading active (4 workers).');
    }, 5000);

    const epochInterval = 6000;
    for (let epoch = 1; epoch <= job.totalEpochs; epoch++) {
      const stepsPerEpoch = 12;
      for (let step = 1; step <= stepsPerEpoch; step++) {
        setTimeout(async () => {
          const globalStep = (epoch - 1) * stepsPerEpoch + step;
          const trainLoss = parseFloat((2.4 - (globalStep / (job.totalEpochs * stepsPerEpoch)) * 1.6 + (Math.random() - 0.5) * 0.06).toFixed(4));
          const valLoss = parseFloat((trainLoss + 0.08 + Math.random() * 0.03).toFixed(4));
          const lr = parseFloat((2e-4 * (1 - (globalStep / (job.totalEpochs * stepsPerEpoch)) * 0.3)).toFixed(6));
          const tps = Math.round(1800 + Math.random() * 400);

          await pushMetric({ step: globalStep, epoch, trainLoss, valLoss, learningRate: lr, tokensPerSec: tps });

          if (step === stepsPerEpoch) {
            await update({ currentEpoch: epoch, progress: Math.round((epoch / job.totalEpochs) * 85), trainLoss, valLoss });
            await pushLog(`[epoch ${epoch}/${job.totalEpochs}] train_loss=${trainLoss} val_loss=${valLoss} lr=${lr.toExponential(2)} tok/s=${tps}`);
          }
        }, 5000 + (epoch - 1) * epochInterval + (step / stepsPerEpoch) * epochInterval);
      }
    }

    setTimeout(async () => {
      await update({ status: 'packaging', progress: 90 });
      await pushLog('[packaging] Training complete. Merging LoRA adapters into base model...');
      await pushLog('[packaging] Running GGUF quantization (Q4_K_M)...');
    }, 5000 + job.totalEpochs * epochInterval + 500);

    setTimeout(async () => {
      const j = await this.jobRepo.findOne({ where: { id: jobId } });
      if (!j) return;
      const actualCost = parseFloat((j.estimatedCostUsd * (0.88 + Math.random() * 0.18)).toFixed(2));
      await update({ status: 'completed', progress: 100, completedAt: new Date(), actualCostUsd: actualCost });
      await pushLog('[done] Adapter checkpoint saved (32 MB).');
      await pushLog('[done] Merged FP16 model saved (4.7 GB).');
      await pushLog('[done] GGUF Q4_K_M quantization complete (1.3 GB).');
      await pushLog('[done] Model artifacts ready for download.');

      const outputFormat = (j.config as any)?.outputFormat || 'gguf';
      const baseModelId = j.baseModelId || 'llama-3.1-8b-instruct';
      await this.artifactsService.createJobArtifacts(j.ownerId, j.id, j.modelName, baseModelId, outputFormat);
    }, 5000 + job.totalEpochs * epochInterval + 4000);
  }

  findAll(ownerId: string): Promise<TrainingJob[]> {
    return this.jobRepo.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, ownerId: string): Promise<TrainingJob> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.ownerId !== ownerId) throw new ForbiddenException();
    return job;
  }

  async getMetrics(id: string, ownerId: string): Promise<MetricPoint[]> {
    const job = await this.findOne(id, ownerId);
    return (job.metrics || []) as MetricPoint[];
  }

  async cancel(id: string, ownerId: string): Promise<TrainingJob> {
    const job = await this.findOne(id, ownerId);
    if (['completed', 'failed', 'cancelled'].includes(job.status)) return job;
    const logs = [...(job.logs as string[]), '[cancelled] Job cancelled by user.'];
    await this.jobRepo.update(id, { status: 'cancelled', completedAt: new Date(), logs });
    return this.jobRepo.findOne({ where: { id } }) as Promise<TrainingJob>;
  }
}
