import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateModelDto, BaseModel, QuantizationMode } from './models.dto';

export interface LlmModel {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  baseModel: BaseModel;
  quantization: QuantizationMode;
  contextLength: number;
  tags: string[];
  status: 'draft' | 'training' | 'ready' | 'deployed' | 'failed';
  parameterCount: string;
  estimatedSizeGb: number;
  trainingJobId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BASE_PARAMS: Record<BaseModel, { params: string; sizeGb: number }> = {
  [BaseModel.GEMMA_2B]: { params: '2B', sizeGb: 1.5 },
  [BaseModel.PHI_3_MINI]: { params: '3.8B', sizeGb: 2.4 },
  [BaseModel.MISTRAL_7B]: { params: '7B', sizeGb: 4.1 },
  [BaseModel.LLAMA_3_8B]: { params: '8B', sizeGb: 4.7 },
  [BaseModel.GEMMA_7B]: { params: '7B', sizeGb: 4.2 },
  [BaseModel.LLAMA_3_70B]: { params: '70B', sizeGb: 39.0 },
};

const QUANT_FACTOR: Record<QuantizationMode, number> = {
  [QuantizationMode.NONE]: 1.0,
  [QuantizationMode.INT8]: 0.5,
  [QuantizationMode.INT4]: 0.28,
  [QuantizationMode.GPTQ]: 0.25,
  [QuantizationMode.GGUF]: 0.22,
};

@Injectable()
export class ModelsService {
  private readonly models = new Map<string, LlmModel>();

  create(ownerId: string, dto: CreateModelDto): LlmModel {
    const base = BASE_PARAMS[dto.baseModel];
    const model: LlmModel = {
      id: uuidv4(),
      ownerId,
      name: dto.name,
      description: dto.description,
      baseModel: dto.baseModel,
      quantization: dto.quantization,
      contextLength: dto.contextLength || 4096,
      tags: dto.tags || [],
      status: 'draft',
      parameterCount: base.params,
      estimatedSizeGb: parseFloat((base.sizeGb * QUANT_FACTOR[dto.quantization]).toFixed(2)),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.models.set(model.id, model);
    return model;
  }

  findAll(ownerId: string): LlmModel[] {
    return [...this.models.values()].filter((m) => m.ownerId === ownerId);
  }

  findOne(id: string, ownerId: string): LlmModel {
    const m = this.models.get(id);
    if (!m) throw new NotFoundException('Model not found');
    if (m.ownerId !== ownerId) throw new ForbiddenException();
    return m;
  }

  updateStatus(id: string, status: LlmModel['status'], trainingJobId?: string) {
    const m = this.models.get(id);
    if (m) {
      m.status = status;
      if (trainingJobId) m.trainingJobId = trainingJobId;
      m.updatedAt = new Date();
    }
  }

  remove(id: string, ownerId: string) {
    this.findOne(id, ownerId);
    this.models.delete(id);
  }
}
