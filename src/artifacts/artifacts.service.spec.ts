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

    const artifact = await new ArtifactsService(
      repo(),
    ).createLocalGgufLoraAdapter({
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

describe('ArtifactsService merged full-fine-tune GGUF export', () => {
  const originalRoot = process.env.TRAINING_OUTPUT_ROOT;
  const originalConvertScript = process.env.GGUF_HF_CONVERT_SCRIPT;
  const originalQuantizeBin = process.env.GGUF_QUANTIZE_BIN;
  let root: string;
  let outputPath: string;

  const repo = () =>
    ({
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'artifact-1' })),
      update: jest.fn(async () => ({ affected: 1 })),
    }) as unknown as Repository<Artifact>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'llm-forge-gguf-merged-'));
    process.env.TRAINING_OUTPUT_ROOT = root;
    outputPath = join(root, 'job-1');
    mkdirSync(outputPath);
    writeFileSync(join(outputPath, 'config.json'), '{}');
    // Any existing file satisfies the "tooling installed" check without
    // depending on the real (gitignored) vendor-llama-cpp checkout.
    process.env.GGUF_HF_CONVERT_SCRIPT = join(outputPath, 'config.json');
    process.env.GGUF_QUANTIZE_BIN = join(outputPath, 'config.json');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (originalRoot === undefined) delete process.env.TRAINING_OUTPUT_ROOT;
    else process.env.TRAINING_OUTPUT_ROOT = originalRoot;
    if (originalConvertScript === undefined)
      delete process.env.GGUF_HF_CONVERT_SCRIPT;
    else process.env.GGUF_HF_CONVERT_SCRIPT = originalConvertScript;
    if (originalQuantizeBin === undefined) delete process.env.GGUF_QUANTIZE_BIN;
    else process.env.GGUF_QUANTIZE_BIN = originalQuantizeBin;
    mockedSpawn.mockReset();
  });

  const mockSuccessfulTwoStepConversion = () => {
    mockedSpawn.mockImplementation((_exe: string, args: string[]) => {
      const outfileFlagIndex = args.indexOf('--outfile');
      if (outfileFlagIndex !== -1) {
        // Step 1: convert_hf_to_gguf.py --outfile <f16Path> ...
        writeFileSync(args[outfileFlagIndex + 1], 'f16-bytes');
      } else {
        // Step 2: llama-quantize <f16Path> <quantPath> <quant>
        writeFileSync(args[1], 'quant-bytes');
      }
      const child = new EventEmitter() as any;
      child.stderr = new EventEmitter();
      setImmediate(() => child.emit('exit', 0));
      return child;
    });
  };

  it('registers a real quantized GGUF artifact produced by the two-step conversion', async () => {
    mockSuccessfulTwoStepConversion();

    const artifact = await new ArtifactsService(
      repo(),
    ).createLocalMergedGgufArtifact({
      ownerId: 'owner-1',
      jobId: 'job-1',
      modelName: 'Test model',
      baseModelId: 'qwen3',
      outputPath,
    });

    expect(artifact.format).toBe('gguf');
    expect(artifact.filename).toBe('merged-q4_k_m.gguf');
    expect(artifact.fileSizeBytes).toBe('quant-bytes'.length);
    expect(artifact.quantBits).toBe(4);
    expect(artifact.downloadUrl).toBe('/api/v1/artifacts/artifact-1/download');
    expect(mockedSpawn).toHaveBeenCalledTimes(2);
  });

  it('honors a custom --quant target in the output filename', async () => {
    mockSuccessfulTwoStepConversion();

    const artifact = await new ArtifactsService(
      repo(),
    ).createLocalMergedGgufArtifact({
      ownerId: 'owner-1',
      jobId: 'job-1',
      modelName: 'Test model',
      baseModelId: 'qwen3',
      outputPath,
      quant: 'Q8_0',
    });

    expect(artifact.filename).toBe('merged-q8_0.gguf');
    const quantizeCallArgs = mockedSpawn.mock.calls[1][1] as string[];
    expect(quantizeCallArgs).toContain('Q8_0');
  });

  it('rejects when the checkpoint has no config.json', async () => {
    rmSync(join(outputPath, 'config.json'));

    await expect(
      new ArtifactsService(repo()).createLocalMergedGgufArtifact({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen3',
        outputPath,
      }),
    ).rejects.toThrow('Merged model checkpoint was not created');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('rejects output paths outside the configured output root', async () => {
    await expect(
      new ArtifactsService(repo()).createLocalMergedGgufArtifact({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen3',
        outputPath: join(root, '..', 'outside'),
      }),
    ).rejects.toThrow('outside the configured output root');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('reports missing tooling instead of spawning a nonexistent binary', async () => {
    process.env.GGUF_QUANTIZE_BIN = join(outputPath, 'does-not-exist-bin');

    await expect(
      new ArtifactsService(repo()).createLocalMergedGgufArtifact({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen3',
        outputPath,
      }),
    ).rejects.toThrow('GGUF conversion tooling is not installed');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('surfaces the HF->F16 conversion stderr when step 1 exits non-zero', async () => {
    mockedSpawn.mockImplementation(() => {
      const child = new EventEmitter() as any;
      child.stderr = new EventEmitter();
      setImmediate(() => {
        child.stderr.emit('data', Buffer.from('unsupported architecture'));
        child.emit('exit', 1);
      });
      return child;
    });

    await expect(
      new ArtifactsService(repo()).createLocalMergedGgufArtifact({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen3',
        outputPath,
      }),
    ).rejects.toThrow('unsupported architecture');
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
  });

  it('surfaces the quantize stderr when step 2 exits non-zero', async () => {
    let call = 0;
    mockedSpawn.mockImplementation((_exe: string, args: string[]) => {
      call += 1;
      const child = new EventEmitter() as any;
      child.stderr = new EventEmitter();
      if (call === 1) {
        const outfileFlagIndex = args.indexOf('--outfile');
        writeFileSync(args[outfileFlagIndex + 1], 'f16-bytes');
        setImmediate(() => child.emit('exit', 0));
      } else {
        setImmediate(() => {
          child.stderr.emit('data', Buffer.from('quantize failed'));
          child.emit('exit', 1);
        });
      }
      return child;
    });

    await expect(
      new ArtifactsService(repo()).createLocalMergedGgufArtifact({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen3',
        outputPath,
      }),
    ).rejects.toThrow('quantize failed');
    expect(mockedSpawn).toHaveBeenCalledTimes(2);
  });
});

describe('ArtifactsService GPTQ export', () => {
  const originalRoot = process.env.TRAINING_OUTPUT_ROOT;
  const originalScript = process.env.GPTQ_QUANTIZE_SCRIPT;
  let root: string;
  let outputPath: string;

  const repo = () =>
    ({
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'artifact-1' })),
      update: jest.fn(async () => ({ affected: 1 })),
    }) as unknown as Repository<Artifact>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'llm-forge-gptq-'));
    process.env.TRAINING_OUTPUT_ROOT = root;
    outputPath = join(root, 'job-1');
    mkdirSync(outputPath);
    writeFileSync(join(outputPath, 'config.json'), '{}');
    // Any existing file satisfies the "tooling installed" check without
    // depending on a real (CUDA-only, not runnable in CI) gptqmodel install.
    process.env.GPTQ_QUANTIZE_SCRIPT = join(outputPath, 'config.json');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (originalRoot === undefined) delete process.env.TRAINING_OUTPUT_ROOT;
    else process.env.TRAINING_OUTPUT_ROOT = originalRoot;
    if (originalScript === undefined) delete process.env.GPTQ_QUANTIZE_SCRIPT;
    else process.env.GPTQ_QUANTIZE_SCRIPT = originalScript;
    mockedSpawn.mockReset();
  });

  const mockSuccessfulQuantizeAndPackage = () => {
    mockedSpawn.mockImplementation((exe: string, args: string[]) => {
      const child = new EventEmitter() as any;
      child.stderr = new EventEmitter();
      if (exe === 'tar') {
        // tar -czf <archivePath> -C <quantDir> .
        writeFileSync(args[1], 'tarball-bytes');
      } else {
        // python gptq_quantize.py --model-dir ... --out <quantDir> ...
        const outDir = args[args.indexOf('--out') + 1];
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, 'config.json'), '{}');
      }
      setImmediate(() => child.emit('exit', 0));
      return child;
    });
  };

  it('registers a real GPTQ artifact packaged as a tarball', async () => {
    mockSuccessfulQuantizeAndPackage();

    const artifact = await new ArtifactsService(repo()).createLocalGptqArtifact(
      {
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen2.5-7b-instruct',
        outputPath,
      },
    );

    expect(artifact.format).toBe('gptq');
    expect(artifact.filename).toBe('gptq-int4.tar.gz');
    expect(artifact.fileSizeBytes).toBe('tarball-bytes'.length);
    expect(artifact.quantBits).toBe(4);
    expect(artifact.downloadUrl).toBe('/api/v1/artifacts/artifact-1/download');
    expect(mockedSpawn).toHaveBeenCalledTimes(2);
  });

  it('honors a custom bits value in the recorded quantBits', async () => {
    mockSuccessfulQuantizeAndPackage();

    const artifact = await new ArtifactsService(repo()).createLocalGptqArtifact(
      {
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen2.5-7b-instruct',
        outputPath,
        bits: 8,
      },
    );

    expect(artifact.quantBits).toBe(8);
    const quantizeCallArgs = mockedSpawn.mock.calls[0][1] as string[];
    expect(quantizeCallArgs).toContain('8');
  });

  it('rejects when the checkpoint has no config.json', async () => {
    rmSync(join(outputPath, 'config.json'));

    await expect(
      new ArtifactsService(repo()).createLocalGptqArtifact({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen2.5-7b-instruct',
        outputPath,
      }),
    ).rejects.toThrow('Merged model checkpoint was not created');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('rejects output paths outside the configured output root', async () => {
    await expect(
      new ArtifactsService(repo()).createLocalGptqArtifact({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen2.5-7b-instruct',
        outputPath: join(root, '..', 'outside'),
      }),
    ).rejects.toThrow('outside the configured output root');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('reports missing tooling instead of spawning a nonexistent script', async () => {
    process.env.GPTQ_QUANTIZE_SCRIPT = join(outputPath, 'does-not-exist.py');

    await expect(
      new ArtifactsService(repo()).createLocalGptqArtifact({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen2.5-7b-instruct',
        outputPath,
      }),
    ).rejects.toThrow('GPTQ quantization tooling is not installed');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('surfaces the calibration stderr when quantization exits non-zero', async () => {
    mockedSpawn.mockImplementation(() => {
      const child = new EventEmitter() as any;
      child.stderr = new EventEmitter();
      setImmediate(() => {
        child.stderr.emit('data', Buffer.from('CUDA out of memory'));
        child.emit('exit', 1);
      });
      return child;
    });

    await expect(
      new ArtifactsService(repo()).createLocalGptqArtifact({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen2.5-7b-instruct',
        outputPath,
      }),
    ).rejects.toThrow('CUDA out of memory');
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
  });

  it('surfaces the tar stderr when packaging exits non-zero', async () => {
    let call = 0;
    mockedSpawn.mockImplementation((exe: string, args: string[]) => {
      call += 1;
      const child = new EventEmitter() as any;
      child.stderr = new EventEmitter();
      if (call === 1) {
        const outDir = args[args.indexOf('--out') + 1];
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, 'config.json'), '{}');
        setImmediate(() => child.emit('exit', 0));
      } else {
        setImmediate(() => {
          child.stderr.emit('data', Buffer.from('tar: disk full'));
          child.emit('exit', 1);
        });
      }
      return child;
    });

    await expect(
      new ArtifactsService(repo()).createLocalGptqArtifact({
        ownerId: 'owner-1',
        jobId: 'job-1',
        modelName: 'Test model',
        baseModelId: 'qwen2.5-7b-instruct',
        outputPath,
      }),
    ).rejects.toThrow('tar: disk full');
    expect(mockedSpawn).toHaveBeenCalledTimes(2);
  });
});
