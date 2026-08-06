import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { Repository } from 'typeorm';
import { Artifact } from './artifact.entity';
import { ArtifactsService } from './artifacts.service';
import * as childProcess from 'node:child_process';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));
const mockedSpawn = childProcess.spawn as unknown as jest.Mock;

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

describe('ArtifactsService GGUF LoRA export', () => {
  const originalRoot = process.env.TRAINING_OUTPUT_ROOT;
  const originalScript = process.env.GGUF_LORA_CONVERT_SCRIPT;
  let root: string;
  let outputPath: string;

  const repo = () =>
    ({
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'artifact-1' })),
      update: jest.fn(async () => ({ affected: 1 })),
    }) as unknown as Repository<Artifact>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'llm-forge-gguf-'));
    process.env.TRAINING_OUTPUT_ROOT = root;
    outputPath = join(root, 'job-1');
    mkdirSync(outputPath);
    writeFileSync(join(outputPath, 'adapter_config.json'), '{}');
    // Any existing file satisfies the "tooling installed" check without
    // depending on the real (gitignored) vendor-llama-cpp checkout.
    process.env.GGUF_LORA_CONVERT_SCRIPT = join(
      outputPath,
      'adapter_config.json',
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (originalRoot === undefined) delete process.env.TRAINING_OUTPUT_ROOT;
    else process.env.TRAINING_OUTPUT_ROOT = originalRoot;
    if (originalScript === undefined)
      delete process.env.GGUF_LORA_CONVERT_SCRIPT;
    else process.env.GGUF_LORA_CONVERT_SCRIPT = originalScript;
    mockedSpawn.mockReset();
  });

  const mockSuccessfulConversion = (fileContents = 'gguf-bytes') => {
    mockedSpawn.mockImplementation((_exe: string, args: string[]) => {
      const outfile = args[args.indexOf('--outfile') + 1];
      writeFileSync(outfile, fileContents);
      const child = new EventEmitter() as any;
      child.stderr = new EventEmitter();
      setImmediate(() => child.emit('exit', 0));
      return child;
    });
  };

  it('registers a real GGUF artifact produced by the conversion tool', async () => {
    mockSuccessfulConversion();

    const artifact = await new ArtifactsService(repo()).createLocalGgufLoraAdapter({
      ownerId: 'owner-1',
      jobId: 'job-1',
      modelName: 'Test model',
      baseModelId: 'qwen3',
      outputPath,
    });

    expect(artifact.format).toBe('gguf');
    expect(artifact.filename).toBe('adapter.gguf');
    expect(artifact.fileSizeBytes).toBe('gguf-bytes'.length);
    expect(artifact.downloadUrl).toBe('/api/v1/artifacts/artifact-1/download');
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
  });

  it('rejects when the adapter has no adapter_config.json', async () => {
    rmSync(join(outputPath, 'adapter_config.json'));

    await expect(
      new ArtifactsService(repo()).createLocalGgufLoraAdapter({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen3',
        outputPath,
      }),
    ).rejects.toThrow('LoRA adapter config was not created');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('rejects output paths outside the configured output root', async () => {
    await expect(
      new ArtifactsService(repo()).createLocalGgufLoraAdapter({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen3',
        outputPath: join(root, '..', 'outside'),
      }),
    ).rejects.toThrow('outside the configured output root');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('surfaces the conversion tool stderr when it exits non-zero', async () => {
    mockedSpawn.mockImplementation(() => {
      const child = new EventEmitter() as any;
      child.stderr = new EventEmitter();
      setImmediate(() => {
        child.stderr.emit('data', Buffer.from('lora rank mismatch'));
        child.emit('exit', 1);
      });
      return child;
    });

    await expect(
      new ArtifactsService(repo()).createLocalGgufLoraAdapter({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen3',
        outputPath,
      }),
    ).rejects.toThrow('lora rank mismatch');
  });
});
