import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dataset } from './dataset.entity';
import { CreateDatasetDto } from './datasets.dto';

@Injectable()
export class DatasetsService {
  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepo: Repository<Dataset>,
  ) {}

  async create(ownerId: string, dto: CreateDatasetDto, file: Express.Multer.File): Promise<Dataset> {
    const dataset = this.datasetRepo.create({
      ownerId,
      name: dto.name,
      description: dto.description,
      type: dto.type,
      tags: dto.tags || [],
      status: 'processing',
      fileSize: file.size,
      recordCount: 0,
      filePath: file.path || `uploads/${file.originalname}`,
    });
    const saved = await this.datasetRepo.save(dataset);

    // Simulate async processing
    setTimeout(() => this.finishProcessing(saved.id, file.size), 2000);
    return saved;
  }

  private async finishProcessing(id: string, fileSize: number) {
    await this.datasetRepo.update(id, {
      status: 'ready',
      recordCount: Math.floor(fileSize / 256),
    });
  }

  findAll(ownerId: string): Promise<Dataset[]> {
    return this.datasetRepo.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, ownerId: string): Promise<Dataset> {
    const ds = await this.datasetRepo.findOne({ where: { id } });
    if (!ds) throw new NotFoundException('Dataset not found');
    if (ds.ownerId !== ownerId) throw new ForbiddenException();
    return ds;
  }

  async remove(id: string, ownerId: string): Promise<void> {
    await this.findOne(id, ownerId);
    await this.datasetRepo.delete(id);
  }

  async stats(ownerId: string) {
    const all = await this.findAll(ownerId);
    return {
      total: all.length,
      ready: all.filter((d) => d.status === 'ready').length,
      totalSizeBytes: all.reduce((s, d) => s + Number(d.fileSize), 0),
      totalRecords: all.reduce((s, d) => s + d.recordCount, 0),
    };
  }
}
