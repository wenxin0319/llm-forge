import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateDatasetDto, DatasetType } from './datasets.dto';

export interface Dataset {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  type: DatasetType;
  tags: string[];
  status: 'uploading' | 'processing' | 'ready' | 'error';
  fileSize: number;
  recordCount: number;
  filePath: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DatasetsService {
  private readonly datasets = new Map<string, Dataset>();

  create(ownerId: string, dto: CreateDatasetDto, file: Express.Multer.File): Dataset {
    const dataset: Dataset = {
      id: uuidv4(),
      ownerId,
      name: dto.name,
      description: dto.description,
      type: dto.type,
      tags: dto.tags || [],
      status: 'processing',
      fileSize: file.size,
      recordCount: 0,
      filePath: file.path || `uploads/${file.originalname}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.datasets.set(dataset.id, dataset);
    // Simulate async processing
    setTimeout(() => this.finishProcessing(dataset.id, file.size), 2000);
    return dataset;
  }

  private finishProcessing(id: string, fileSize: number) {
    const ds = this.datasets.get(id);
    if (ds) {
      ds.status = 'ready';
      ds.recordCount = Math.floor(fileSize / 256); // rough estimate
      ds.updatedAt = new Date();
    }
  }

  findAll(ownerId: string): Dataset[] {
    return [...this.datasets.values()].filter((d) => d.ownerId === ownerId);
  }

  findOne(id: string, ownerId: string): Dataset {
    const ds = this.datasets.get(id);
    if (!ds) throw new NotFoundException('Dataset not found');
    if (ds.ownerId !== ownerId) throw new ForbiddenException();
    return ds;
  }

  remove(id: string, ownerId: string): void {
    this.findOne(id, ownerId);
    this.datasets.delete(id);
  }

  stats(ownerId: string) {
    const all = this.findAll(ownerId);
    return {
      total: all.length,
      ready: all.filter((d) => d.status === 'ready').length,
      totalSizeBytes: all.reduce((s, d) => s + d.fileSize, 0),
      totalRecords: all.reduce((s, d) => s + d.recordCount, 0),
    };
  }
}
