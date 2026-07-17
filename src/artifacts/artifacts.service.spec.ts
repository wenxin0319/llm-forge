import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { Artifact } from './artifact.entity';
import { ArtifactsService } from './artifacts.service';

describe('ArtifactsService local adapter registration', () => {
  const originalRoot = process.env.TRAINING_OUTPUT_ROOT;
  let root: string;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    if (originalRoot === undefined) delete process.env.TRAINING_OUTPUT_ROOT;
    else process.env.TRAINING_OUTPUT_ROOT = originalRoot;
  });

  it('records exact size and SHA-256 for a worker adapter', async () => {
    root = mkdtempSync(join(tmpdir(), 'llm-forge-artifact-'));
    process.env.TRAINING_OUTPUT_ROOT = root;
    const outputPath = join(root, 'job-1');
    mkdirSync(outputPath);
    writeFileSync(
      join(outputPath, 'adapter_model.safetensors'),
      'adapter-bytes',
    );

    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'artifact-1' })),
      update: jest.fn(async () => ({ affected: 1 })),
    } as unknown as Repository<Artifact>;
    const artifact = await new ArtifactsService(repo).createLocalAdapter({
      ownerId: 'owner-1',
      jobId: 'job-1',
      modelName: 'Test model',
      baseModelId: 'qwen3',
      outputPath,
    });

    expect(artifact.fileSizeBytes).toBe(13);
    expect(artifact.sha256).toBe(
      'cd06a2d3968bd0a5ed8d1a66b3bb8f27a0b58d2f99d9b3921a2f9ed778d489a3',
    );
    expect(artifact.downloadUrl).toBe('/api/v1/artifacts/artifact-1/download');
  });

  it('rejects adapter paths outside the configured output root', async () => {
    root = mkdtempSync(join(tmpdir(), 'llm-forge-artifact-'));
    process.env.TRAINING_OUTPUT_ROOT = join(root, 'allowed');
    const repo = {} as Repository<Artifact>;

    await expect(
      new ArtifactsService(repo).createLocalAdapter({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen3',
        outputPath: join(root, 'outside'),
      }),
    ).rejects.toThrow('outside the configured output root');
  });
});
