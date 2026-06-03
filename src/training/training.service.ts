import { Injectable, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { TrainingConfigDto, GpuType } from './training.dto';
import { JobsService } from '../jobs/jobs.service';
import { ModelsService } from '../models/models.service';
import { DatasetsService } from '../datasets/datasets.service';

const GPU_VRAM: Record<GpuType, number> = {
  [GpuType.RTX_4090]: 24,
  [GpuType.A100_40GB]: 40,
  [GpuType.A100_80GB]: 80,
  [GpuType.H100_80GB]: 80,
};

const GPU_TFLOPS: Record<GpuType, number> = {
  [GpuType.RTX_4090]: 82.6,
  [GpuType.A100_40GB]: 312,
  [GpuType.A100_80GB]: 312,
  [GpuType.H100_80GB]: 989,
};

const GPU_COST_PER_HOUR: Record<GpuType, number> = {
  [GpuType.RTX_4090]: 0.74,
  [GpuType.A100_40GB]: 2.10,
  [GpuType.A100_80GB]: 3.20,
  [GpuType.H100_80GB]: 5.89,
};

@Injectable()
export class TrainingService {
  constructor(
    private readonly jobsService: JobsService,
    private readonly modelsService: ModelsService,
    private readonly datasetsService: DatasetsService,
  ) {}

  launch(ownerId: string, config: TrainingConfigDto) {
    const model = this.modelsService.findOne(config.modelId, ownerId);
    const dataset = this.datasetsService.findOne(config.datasetId, ownerId);

    if (dataset.status !== 'ready') {
      throw new BadRequestException('Dataset is not ready yet');
    }

    const gpuCount = config.gpuCount || 1;
    const totalVram = GPU_VRAM[config.gpuType] * gpuCount;
    const totalTflops = GPU_TFLOPS[config.gpuType] * gpuCount;
    const estimatedHours = this.estimateTrainingHours(dataset.recordCount, config.epochs || 3, totalTflops);
    const estimatedCost = estimatedHours * GPU_COST_PER_HOUR[config.gpuType] * gpuCount;

    const job = this.jobsService.create(ownerId, {
      modelId: model.id,
      modelName: model.name,
      datasetId: dataset.id,
      datasetName: dataset.name,
      config,
      gpuVramGb: totalVram,
      gpuTflops: totalTflops,
      estimatedHours: parseFloat(estimatedHours.toFixed(2)),
      estimatedCostUsd: parseFloat(estimatedCost.toFixed(2)),
    });

    this.modelsService.updateStatus(model.id, 'training', job.id);
    return job;
  }

  private estimateTrainingHours(recordCount: number, epochs: number, tflops: number): number {
    const tokensPerRecord = 512;
    const totalTokens = recordCount * tokensPerRecord * epochs;
    const flopsPerToken = 6e9; // ~6B flops per token for 7B model
    const totalFlops = totalTokens * flopsPerToken;
    const efficiency = 0.4; // realistic GPU utilization
    return totalFlops / (tflops * 1e12 * efficiency * 3600);
  }

  estimateCost(config: TrainingConfigDto, recordCount: number) {
    const gpuCount = config.gpuCount || 1;
    const totalTflops = GPU_TFLOPS[config.gpuType] * gpuCount;
    const estimatedHours = this.estimateTrainingHours(recordCount, config.epochs || 3, totalTflops);
    return {
      gpuType: config.gpuType,
      gpuCount,
      totalVramGb: GPU_VRAM[config.gpuType] * gpuCount,
      totalTflops: totalTflops,
      estimatedHours: parseFloat(estimatedHours.toFixed(2)),
      estimatedCostUsd: parseFloat((estimatedHours * GPU_COST_PER_HOUR[config.gpuType] * gpuCount).toFixed(2)),
      costPerHour: GPU_COST_PER_HOUR[config.gpuType] * gpuCount,
    };
  }
}
