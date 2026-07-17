import { Injectable, BadRequestException } from '@nestjs/common';
import { TrainingConfigDto, GpuType } from './training.dto';
import { JobsService } from '../jobs/jobs.service';
import { ModelsService } from '../models/models.service';
import { DatasetsService } from '../datasets/datasets.service';
import { ModelCatalogService } from '../model-catalog/model-catalog.service';

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
  [GpuType.A100_40GB]: 2.1,
  [GpuType.A100_80GB]: 3.2,
  [GpuType.H100_80GB]: 5.89,
};

@Injectable()
export class TrainingService {
  constructor(
    private readonly jobsService: JobsService,
    private readonly modelsService: ModelsService,
    private readonly datasetsService: DatasetsService,
    private readonly catalogService: ModelCatalogService,
  ) {}

  async launch(ownerId: string, config: TrainingConfigDto) {
    const dataset = await this.datasetsService.findOne(
      config.datasetId,
      ownerId,
    );

    if (dataset.status !== 'ready') {
      throw new BadRequestException('Dataset is not ready yet');
    }

    const gpuCount = config.gpuCount || 1;
    const totalVram = GPU_VRAM[config.gpuType] * gpuCount;
    const totalTflops = GPU_TFLOPS[config.gpuType] * gpuCount;
    const estimatedHours = this.estimateTrainingHours(
      dataset.recordCount,
      config.epochs || 3,
      totalTflops,
    );
    const estimatedCost =
      estimatedHours * GPU_COST_PER_HOUR[config.gpuType] * gpuCount;

    let modelId = config.modelId;
    let modelName: string;
    let baseModelId: string;
    let modelSource: string;
    let userModelId: string | undefined;

    try {
      const userModel = await this.modelsService.findOne(
        config.modelId,
        ownerId,
      );
      const catalogModel = this.catalogService.findOne(
        config.baseModelId || userModel.baseModel,
      );
      userModelId = userModel.id;
      modelName = userModel.name;
      baseModelId = catalogModel.id;
      modelSource = catalogModel.huggingfaceId;
    } catch (error) {
      if (config.baseModelId && config.baseModelId !== config.modelId)
        throw error;
      const catalogModel = this.catalogService.findOne(
        config.baseModelId || config.modelId,
      );
      modelId = catalogModel.id;
      modelName = catalogModel.name;
      baseModelId = catalogModel.id;
      modelSource = catalogModel.huggingfaceId;
    }

    const job = await this.jobsService.create(ownerId, {
      modelId,
      modelName,
      baseModelId,
      modelSource,
      datasetId: dataset.id,
      datasetName: dataset.name,
      datasetPath: dataset.filePath,
      config,
      gpuVramGb: totalVram,
      gpuTflops: totalTflops,
      estimatedHours: parseFloat(estimatedHours.toFixed(2)),
      estimatedCostUsd: parseFloat(estimatedCost.toFixed(2)),
    });

    if (userModelId)
      await this.modelsService.updateStatus(userModelId, 'training', job.id);

    if (baseModelId) {
      this.catalogService
        .trackJobLaunch(baseModelId, config.method || 'qlora')
        .catch(() => {});
    }

    return job;
  }

  private estimateTrainingHours(
    recordCount: number,
    epochs: number,
    tflops: number,
  ): number {
    const totalTokens = recordCount * 512 * epochs;
    const totalFlops = totalTokens * 6e9;
    return totalFlops / (tflops * 1e12 * 0.4 * 3600);
  }

  estimateCost(config: TrainingConfigDto, recordCount: number) {
    const gpuCount = config.gpuCount || 1;
    const totalTflops = GPU_TFLOPS[config.gpuType] * gpuCount;
    const estimatedHours = this.estimateTrainingHours(
      recordCount,
      config.epochs || 3,
      totalTflops,
    );
    return {
      gpuType: config.gpuType,
      gpuCount,
      totalVramGb: GPU_VRAM[config.gpuType] * gpuCount,
      totalTflops,
      estimatedHours: parseFloat(estimatedHours.toFixed(2)),
      estimatedCostUsd: parseFloat(
        (estimatedHours * GPU_COST_PER_HOUR[config.gpuType] * gpuCount).toFixed(
          2,
        ),
      ),
      costPerHour: GPU_COST_PER_HOUR[config.gpuType] * gpuCount,
    };
  }
}
