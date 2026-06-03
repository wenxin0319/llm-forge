import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export type ArtifactFormat = 'adapter' | 'merged' | 'gguf' | 'gptq' | 'awq';
export type ArtifactStatus = 'ready' | 'quantizing' | 'error';

export interface ModelArtifact {
  id: string;
  ownerId: string;
  jobId: string;
  modelName: string;
  baseModelId: string;
  format: ArtifactFormat;
  status: ArtifactStatus;
  fileSizeGb: number;
  quantBits?: number;
  downloadUrl?: string;
  createdAt: Date;
  expiresAt?: Date;
}

@Injectable()
export class ArtifactsService {
  private readonly artifacts = new Map<string, ModelArtifact>();

  create(ownerId: string, data: Omit<ModelArtifact, 'id' | 'status' | 'createdAt' | 'downloadUrl'>): ModelArtifact {
    const artifact: ModelArtifact = {
      id: uuidv4(),
      status: 'ready',
      createdAt: new Date(),
      downloadUrl: this.generateDownloadUrl(uuidv4()),
      ...data,
      ownerId,
    };
    this.artifacts.set(artifact.id, artifact);
    return artifact;
  }

  findAll(ownerId: string, jobId?: string): ModelArtifact[] {
    return [...this.artifacts.values()].filter(
      (a) => a.ownerId === ownerId && (!jobId || a.jobId === jobId),
    );
  }

  findOne(id: string, ownerId: string): ModelArtifact {
    const artifact = this.artifacts.get(id);
    if (!artifact) throw new NotFoundException('Artifact not found');
    if (artifact.ownerId !== ownerId) throw new ForbiddenException();
    return artifact;
  }

  scheduleQuantization(id: string, ownerId: string, format: 'gguf' | 'gptq' | 'awq'): ModelArtifact {
    const source = this.findOne(id, ownerId);
    const bits = format === 'gguf' ? 4 : format === 'gptq' ? 4 : 4;

    const newArtifact: ModelArtifact = {
      id: uuidv4(),
      ownerId,
      jobId: source.jobId,
      modelName: source.modelName,
      baseModelId: source.baseModelId,
      format,
      status: 'quantizing',
      fileSizeGb: parseFloat((source.fileSizeGb * 0.28).toFixed(2)),
      quantBits: bits,
      createdAt: new Date(),
    };
    this.artifacts.set(newArtifact.id, newArtifact);

    // Simulate quantization completing
    setTimeout(() => {
      newArtifact.status = 'ready';
      newArtifact.downloadUrl = this.generateDownloadUrl(newArtifact.id);
    }, 8000);

    return newArtifact;
  }

  remove(id: string, ownerId: string): void {
    this.findOne(id, ownerId);
    this.artifacts.delete(id);
  }

  private generateDownloadUrl(artifactId: string): string {
    const expires = new Date(Date.now() + 3600 * 1000).toISOString();
    return `https://storage.llmforge.io/artifacts/${artifactId}?token=mock-presigned&expires=${expires}`;
  }

  createJobArtifacts(ownerId: string, jobId: string, modelName: string, baseModelId: string, outputFormat: string): ModelArtifact[] {
    const sizeGb = 4.7; // approx 7B FP16
    const created: ModelArtifact[] = [];

    // Always create adapter
    created.push(this.create(ownerId, { ownerId, jobId, modelName, baseModelId, format: 'adapter', fileSizeGb: 0.03 }));

    if (outputFormat === 'merged' || outputFormat === 'gguf' || outputFormat === 'gptq') {
      created.push(this.create(ownerId, { ownerId, jobId, modelName, baseModelId, format: 'merged', fileSizeGb: sizeGb }));
    }
    if (outputFormat === 'gguf') {
      created.push(this.create(ownerId, { ownerId, jobId, modelName, baseModelId, format: 'gguf', fileSizeGb: parseFloat((sizeGb * 0.28).toFixed(2)), quantBits: 4 }));
    }
    if (outputFormat === 'gptq') {
      created.push(this.create(ownerId, { ownerId, jobId, modelName, baseModelId, format: 'gptq', fileSizeGb: parseFloat((sizeGb * 0.25).toFixed(2)), quantBits: 4 }));
    }

    return created;
  }
}
