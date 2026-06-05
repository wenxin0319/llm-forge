import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateModelDto, BaseModel, QuantizationMode } from './models.dto';
import { LlmModel } from './model.entity';

const BASE_PARAMS: Record<string, { params: string; sizeGb: number }> = {
  [BaseModel.GEMMA_2B]:   { params: '2B',   sizeGb: 1.5 },
  [BaseModel.PHI_3_MINI]: { params: '3.8B', sizeGb: 2.4 },
  [BaseModel.MISTRAL_7B]: { params: '7B',   sizeGb: 4.1 },
  [BaseModel.LLAMA_3_8B]: { params: '8B',   sizeGb: 4.7 },
  [BaseModel.GEMMA_7B]:   { params: '7B',   sizeGb: 4.2 },
  [BaseModel.LLAMA_3_70B]:{ params: '70B',  sizeGb: 39.0 },
};

const QUANT_FACTOR: Record<string, number> = {
  [QuantizationMode.NONE]: 1.0,
  [QuantizationMode.INT8]: 0.5,
  [QuantizationMode.INT4]: 0.28,
  [QuantizationMode.GPTQ]: 0.25,
  [QuantizationMode.GGUF]: 0.22,
};

@Injectable()
export class ModelsService {
  constructor(
    @InjectRepository(LlmModel)
    private readonly modelRepo: Repository<LlmModel>,
  ) {}

  async create(ownerId: string, dto: CreateModelDto): Promise<LlmModel> {
    const base = BASE_PARAMS[dto.baseModel] || { params: '7B', sizeGb: 4.1 };
    const factor = QUANT_FACTOR[dto.quantization] ?? 1.0;

    const model = this.modelRepo.create({
      ownerId,
      name: dto.name,
      description: dto.description,
      baseModel: dto.baseModel,
      quantization: dto.quantization,
      contextLength: dto.contextLength || 4096,
      tags: dto.tags || [],
      status: 'draft',
      parameterCount: base.params,
      estimatedSizeGb: parseFloat((base.sizeGb * factor).toFixed(2)),
    });
    return this.modelRepo.save(model);
  }

  findAll(ownerId: string): Promise<LlmModel[]> {
    return this.modelRepo.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, ownerId: string): Promise<LlmModel> {
    const m = await this.modelRepo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Model not found');
    if (m.ownerId !== ownerId) throw new ForbiddenException();
    return m;
  }

  async updateStatus(id: string, status: LlmModel['status'], trainingJobId?: string) {
    await this.modelRepo.update(id, { status, ...(trainingJobId ? { trainingJobId } : {}) });
  }

  async remove(id: string, ownerId: string): Promise<void> {
    await this.findOne(id, ownerId);
    await this.modelRepo.delete(id);
  }
}
