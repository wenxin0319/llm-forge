import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dataset } from './dataset.entity';
import { CreateDatasetDto, ImportHuggingFaceDto } from './datasets.dto';
import { parseDataset } from './dataset-parsers';

@Injectable()
export class DatasetsService {
  private readonly logger = new Logger(DatasetsService.name);

  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepo: Repository<Dataset>,
  ) {}

  async create(ownerId: string, dto: CreateDatasetDto, file: Express.Multer.File): Promise<Dataset> {
    const filePath = file.path || `uploads/${file.originalname}`;
    const dataset = this.datasetRepo.create({
      ownerId,
      name: dto.name,
      description: dto.description,
      type: dto.type,
      tags: dto.tags || [],
      status: 'processing',
      fileSize: file.size,
      recordCount: 0,
      filePath,
    });
    const saved = await this.datasetRepo.save(dataset);

    // Real parsing/validation runs after the upload response is sent, since it
    // streams the whole file (up to 5 GB) — not blocking the HTTP request on it.
    this.processUpload(saved.id, dto.type, filePath).catch((err) =>
      this.logger.error(`Failed to process dataset ${saved.id}: ${err.message}`),
    );
    return saved;
  }

  private async processUpload(id: string, type: string, filePath: string) {
    const result = await parseDataset(type, filePath);
    const failed = result.recordCount === 0 && !!result.errorMessage;
    await this.datasetRepo.update(id, {
      status: failed ? 'error' : 'ready',
      recordCount: result.recordCount,
      errorMessage: result.errorMessage,
      detectedFormat: result.detectedFormat,
      columns: result.columns,
    });
  }

  async importFromHuggingFace(ownerId: string, dto: ImportHuggingFaceDto): Promise<Dataset> {
    let fileSize = 0;
    let recordCount = 0;
    let hfDescription = '';
    let statsError: string | undefined;

    // Validate repo exists and fetch basic metadata
    const metaRes = await fetch(`https://huggingface.co/api/datasets/${dto.repoId}`);
    if (!metaRes.ok) throw new BadRequestException(`HuggingFace dataset '${dto.repoId}' not found`);
    const meta = (await metaRes.json()) as { description?: string; cardData?: { description?: string } };
    hfDescription = meta.description || meta.cardData?.description || '';

    // Fetch real split sizes from the datasets server (this is HF's own
    // Parquet-converted row/byte counts — not a guess).
    try {
      const infoRes = await fetch(`https://datasets-server.huggingface.co/info?dataset=${dto.repoId}`);
      if (!infoRes.ok) {
        statsError = `HuggingFace datasets-server returned ${infoRes.status} — record count unavailable`;
      } else {
        const info = (await infoRes.json()) as { dataset_info?: Record<string, { splits?: Record<string, { num_examples?: number; num_bytes?: number }> }> };
        const perConfig = Object.values(info.dataset_info ?? {});
        const splits = info.dataset_info?.default?.splits ?? perConfig[0]?.splits ?? {};
        const splitList = Object.values(splits);
        recordCount = splitList.reduce((s, sp) => s + (sp.num_examples ?? 0), 0);
        fileSize = splitList.reduce((s, sp) => s + (sp.num_bytes ?? 0), 0);
        if (splitList.length === 0) statsError = 'Dataset has no Parquet-converted splits available yet on HuggingFace';
      }
    } catch (e) {
      statsError = `Could not reach HuggingFace datasets-server: ${(e as Error).message}`;
    }

    const dataset = this.datasetRepo.create({
      ownerId,
      name: dto.name || dto.repoId.split('/').pop()!,
      description: dto.description || hfDescription || `Imported from HuggingFace: ${dto.repoId}`,
      type: 'parquet',
      tags: ['huggingface', dto.repoId.split('/')[0]],
      status: recordCount > 0 ? 'ready' : 'error',
      fileSize,
      recordCount,
      filePath: `hf://${dto.repoId}`,
      huggingfaceId: dto.repoId,
      errorMessage: recordCount > 0 ? undefined : statsError,
    });

    const saved = await this.datasetRepo.save(dataset);

    return saved;
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
