import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artifact } from './artifact.entity';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { ArtifactStorageService } from './artifact-storage.service';

@Injectable()
export class ArtifactsService {
  constructor(
    @InjectRepository(Artifact)
    private readonly artifactRepo: Repository<Artifact>,
    private readonly storage: ArtifactStorageService,
  ) {}

  async create(data: Partial<Artifact>): Promise<Artifact> {
    const artifact = this.artifactRepo.create({
      ...data,
      status: 'ready',
      downloadUrl: this.generateDownloadUrl(),
    });
    return this.artifactRepo.save(artifact);
  }

  async createLocalAdapter(data: {
    ownerId: string;
    jobId: string;
    modelName: string;
    baseModelId: string;
    outputPath: string;
  }): Promise<Artifact> {
    const storageRoot = resolve(
      process.env.TRAINING_OUTPUT_ROOT ||
        resolve(process.cwd(), 'ml-tools/train/out/jobs'),
    );
    const adapterPath = resolve(data.outputPath, 'adapter_model.safetensors');
    if (!adapterPath.startsWith(`${storageRoot}${sep}`)) {
      throw new ForbiddenException(
        'Artifact path is outside the configured output root',
      );
    }
    if (!existsSync(adapterPath))
      throw new NotFoundException('Adapter output was not created');

    const fileSizeBytes = statSync(adapterPath).size;
    const sha256 = await this.hashFile(adapterPath);
    return this.saveLocalArtifact({
      ownerId: data.ownerId,
      jobId: data.jobId,
      modelName: data.modelName,
      baseModelId: data.baseModelId,
      format: 'adapter',
      storagePath: adapterPath,
      fileSizeBytes,
      sha256,
    });
  }

  /**
   * Converts a completed LoRA/QLoRA adapter to a real GGUF LoRA adapter via
   * llama.cpp's convert_lora_to_gguf.py (ml-tools/gguf/), the tool verified
   * against a real training run — see ml-tools/gguf/README.md. Not
   * applicable to prefix-tuning or full fine-tune outputs: prefix-tuning
   * isn't a weight-delta adapter GGUF can represent, and full fine-tune has
   * no adapter to convert (it would need the full merged-model GGUF path,
   * a separate, heavier conversion this method doesn't attempt).
   */
  async createLocalGgufLoraAdapter(data: {
    ownerId: string;
    jobId: string;
    modelName: string;
    baseModelId: string;
    outputPath: string;
  }): Promise<Artifact> {
    const storageRoot = resolve(
      process.env.TRAINING_OUTPUT_ROOT ||
        resolve(process.cwd(), 'ml-tools/train/out/jobs'),
    );
    const outputPath = resolve(data.outputPath);
    if (!outputPath.startsWith(`${storageRoot}${sep}`)) {
      throw new ForbiddenException(
        'Artifact path is outside the configured output root',
      );
    }
    if (!existsSync(resolve(outputPath, 'adapter_config.json'))) {
      throw new NotFoundException('LoRA adapter config was not created');
    }

    const projectRoot = resolve(process.cwd());
    const script = resolve(
      process.env.GGUF_LORA_CONVERT_SCRIPT ||
        resolve(
          projectRoot,
          'ml-tools/gguf/vendor-llama-cpp/convert_lora_to_gguf.py',
        ),
    );
    if (!existsSync(script)) {
      throw new NotFoundException(
        'GGUF conversion tooling is not installed (run ml-tools/gguf/setup.sh)',
      );
    }
    const venvPython = resolve(projectRoot, 'ml-tools/gguf/.venv/bin/python');
    const executable =
      process.env.GGUF_EXPORT_PYTHON_EXECUTABLE ||
      (existsSync(venvPython) ? venvPython : 'python3');

    const ggufPath = resolve(outputPath, 'adapter.gguf');
    await this.runConversion(executable, [
      script,
      outputPath,
      '--outfile',
      ggufPath,
      '--outtype',
      'f16',
    ]);
    if (!existsSync(ggufPath)) {
      throw new NotFoundException(
        'GGUF conversion did not produce an output file',
      );
    }

    const fileSizeBytes = statSync(ggufPath).size;
    const sha256 = await this.hashFile(ggufPath);
    return this.saveLocalArtifact({
      ownerId: data.ownerId,
      jobId: data.jobId,
      modelName: data.modelName,
      baseModelId: data.baseModelId,
      format: 'gguf',
      storagePath: ggufPath,
      fileSizeBytes,
      sha256,
    });
  }

  /**
   * Converts a completed full-fine-tune checkpoint to a real quantized GGUF
   * via llama.cpp's own two-step pipeline — convert_hf_to_gguf.py (HF
   * safetensors -> F16 GGUF) then the compiled llama-quantize binary (F16 ->
   * a real K-quant) — the same pipeline ml-tools/gguf/convert_to_gguf.py
   * verified against a real checkpoint (see ml-tools/gguf/README.md). Only
   * applicable to full_fine_tune output: LoRA/QLoRA/prefix-tuning save an
   * adapter or prefix, not a standalone HF checkpoint this script can read.
   */
  async createLocalMergedGgufArtifact(data: {
    ownerId: string;
    jobId: string;
    modelName: string;
    baseModelId: string;
    outputPath: string;
    quant?: string;
  }): Promise<Artifact> {
    const storageRoot = resolve(
      process.env.TRAINING_OUTPUT_ROOT ||
        resolve(process.cwd(), 'ml-tools/train/out/jobs'),
    );
    const outputPath = resolve(data.outputPath);
    if (!outputPath.startsWith(`${storageRoot}${sep}`)) {
      throw new ForbiddenException(
        'Artifact path is outside the configured output root',
      );
    }
    if (!existsSync(resolve(outputPath, 'config.json'))) {
      throw new NotFoundException('Merged model checkpoint was not created');
    }

    const projectRoot = resolve(process.cwd());
    const convertScript = resolve(
      process.env.GGUF_HF_CONVERT_SCRIPT ||
        resolve(
          projectRoot,
          'ml-tools/gguf/vendor-llama-cpp/convert_hf_to_gguf.py',
        ),
    );
    const quantizeBin = resolve(
      process.env.GGUF_QUANTIZE_BIN ||
        resolve(
          projectRoot,
          'ml-tools/gguf/vendor-llama-cpp/build/bin/llama-quantize',
        ),
    );
    if (!existsSync(convertScript) || !existsSync(quantizeBin)) {
      throw new NotFoundException(
        'GGUF conversion tooling is not installed (run ml-tools/gguf/setup.sh)',
      );
    }
    const venvPython = resolve(projectRoot, 'ml-tools/gguf/.venv/bin/python');
    const executable =
      process.env.GGUF_EXPORT_PYTHON_EXECUTABLE ||
      (existsSync(venvPython) ? venvPython : 'python3');

    const quant = data.quant || 'Q4_K_M';
    const f16Path = resolve(outputPath, 'merged-f16.gguf');
    await this.runConversion(executable, [
      convertScript,
      '--outfile',
      f16Path,
      '--outtype',
      'f16',
      outputPath,
    ]);
    if (!existsSync(f16Path)) {
      throw new NotFoundException(
        'GGUF conversion did not produce an F16 output file',
      );
    }

    const quantPath = resolve(outputPath, `merged-${quant.toLowerCase()}.gguf`);
    await this.runConversion(quantizeBin, [f16Path, quantPath, quant]);
    if (!existsSync(quantPath)) {
      throw new NotFoundException(
        'GGUF quantization did not produce an output file',
      );
    }

    const fileSizeBytes = statSync(quantPath).size;
    const sha256 = await this.hashFile(quantPath);
    const artifact = await this.saveLocalArtifact({
      ownerId: data.ownerId,
      jobId: data.jobId,
      modelName: data.modelName,
      baseModelId: data.baseModelId,
      format: 'gguf',
      storagePath: quantPath,
      fileSizeBytes,
      sha256,
    });
    await this.artifactRepo.update(artifact.id, { quantBits: 4 });
    artifact.quantBits = 4;
    return artifact;
  }

  /**
   * Converts a completed full-fine-tune checkpoint to a real GPTQ INT4
   * checkpoint via gptqmodel — real calibration forward passes and
   * per-layer Hessian solve, the pipeline ml-tools/quantize/gptq_quantize.py
   * verified against a real checkpoint (see ml-tools/quantize/README.md).
   * Only applicable to full_fine_tune output, same reasoning as the merged
   * GGUF path: LoRA/QLoRA/prefix-tuning save an adapter or prefix, not a
   * standalone HF checkpoint this script can read. GPTQ output is a
   * directory (sharded safetensors + config + tokenizer), not a single
   * file, so it's packaged into a tarball to fit the single-file artifact
   * download model the rest of this service uses.
   */
  async createLocalGptqArtifact(data: {
    ownerId: string;
    jobId: string;
    modelName: string;
    baseModelId: string;
    outputPath: string;
    bits?: number;
    groupSize?: number;
  }): Promise<Artifact> {
    const storageRoot = resolve(
      process.env.TRAINING_OUTPUT_ROOT ||
        resolve(process.cwd(), 'ml-tools/train/out/jobs'),
    );
    const outputPath = resolve(data.outputPath);
    if (!outputPath.startsWith(`${storageRoot}${sep}`)) {
      throw new ForbiddenException(
        'Artifact path is outside the configured output root',
      );
    }
    if (!existsSync(resolve(outputPath, 'config.json'))) {
      throw new NotFoundException('Merged model checkpoint was not created');
    }

    const projectRoot = resolve(process.cwd());
    const quantizeScript = resolve(
      process.env.GPTQ_QUANTIZE_SCRIPT ||
        resolve(projectRoot, 'ml-tools/quantize/gptq_quantize.py'),
    );
    if (!existsSync(quantizeScript)) {
      throw new NotFoundException('GPTQ quantization tooling is not installed');
    }
    const venvPython = resolve(
      projectRoot,
      'ml-tools/quantize/.venv/bin/python',
    );
    const executable =
      process.env.GPTQ_EXPORT_PYTHON_EXECUTABLE ||
      (existsSync(venvPython) ? venvPython : 'python3');

    const bits = data.bits ?? 4;
    const groupSize = data.groupSize ?? 128;
    const quantDir = resolve(outputPath, 'gptq-int4');
    await this.runConversion(executable, [
      quantizeScript,
      '--model-dir',
      outputPath,
      '--out',
      quantDir,
      '--bits',
      String(bits),
      '--group-size',
      String(groupSize),
    ]);
    if (!existsSync(resolve(quantDir, 'config.json'))) {
      throw new NotFoundException(
        'GPTQ quantization did not produce an output checkpoint',
      );
    }

    const archivePath = resolve(outputPath, 'gptq-int4.tar.gz');
    await this.runConversion('tar', ['-czf', archivePath, '-C', quantDir, '.']);
    if (!existsSync(archivePath)) {
      throw new NotFoundException('Failed to package the GPTQ checkpoint');
    }

    const fileSizeBytes = statSync(archivePath).size;
    const sha256 = await this.hashFile(archivePath);
    const artifact = await this.saveLocalArtifact({
      ownerId: data.ownerId,
      jobId: data.jobId,
      modelName: data.modelName,
      baseModelId: data.baseModelId,
      format: 'gptq',
      storagePath: archivePath,
      fileSizeBytes,
      sha256,
    });
    await this.artifactRepo.update(artifact.id, { quantBits: bits });
    artifact.quantBits = bits;
    return artifact;
  }

  private runConversion(executable: string, args: string[]): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      const child = spawn(executable, args, {
        stdio: ['ignore', 'ignore', 'pipe'],
        shell: false,
      });
      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) resolvePromise();
        else
          reject(
            new Error(
              `GGUF conversion failed (exit ${code}): ${stderr.slice(-2000)}`,
            ),
          );
      });
    });
  }

  private async saveLocalArtifact(fields: {
    ownerId: string;
    jobId: string;
    modelName: string;
    baseModelId: string;
    format: string;
    storagePath: string;
    fileSizeBytes: number;
    sha256: string;
  }): Promise<Artifact> {
    const filename = basename(fields.storagePath);

    if (this.storage.isEnabled()) {
      const objectKey = `artifacts/${fields.ownerId}/${fields.jobId}/${filename}`;
      await this.storage.upload(fields.storagePath, objectKey);
      const downloadUrl = await this.storage.getSignedDownloadUrl(
        objectKey,
        filename,
      );
      const artifact = this.artifactRepo.create({
        ownerId: fields.ownerId,
        jobId: fields.jobId,
        modelName: fields.modelName,
        baseModelId: fields.baseModelId,
        format: fields.format,
        status: 'ready',
        filename,
        fileSizeBytes: fields.fileSizeBytes,
        fileSizeGb: Number((fields.fileSizeBytes / 1024 ** 3).toFixed(6)),
        sha256: fields.sha256,
        storageBackend: 's3',
        objectKey,
        downloadUrl,
      });
      return this.artifactRepo.save(artifact);
    }

    const artifact = this.artifactRepo.create({
      ownerId: fields.ownerId,
      jobId: fields.jobId,
      modelName: fields.modelName,
      baseModelId: fields.baseModelId,
      format: fields.format,
      status: 'ready',
      filename,
      storagePath: fields.storagePath,
      storageBackend: 'local',
      fileSizeBytes: fields.fileSizeBytes,
      fileSizeGb: Number((fields.fileSizeBytes / 1024 ** 3).toFixed(6)),
      sha256: fields.sha256,
      downloadUrl: `/api/v1/artifacts/pending/download`,
    });
    const saved = await this.artifactRepo.save(artifact);
    saved.downloadUrl = `/api/v1/artifacts/${saved.id}/download`;
    await this.artifactRepo.update(saved.id, {
      downloadUrl: saved.downloadUrl,
    });
    return saved;
  }

  /** Local artifacts stream from disk through this backend; S3-backed ones
   * redirect to a freshly-signed URL so the link is never a stale, expired
   * one served from a stored column. */
  async getDownload(
    id: string,
    ownerId: string,
  ): Promise<
    | { mode: 'local'; path: string; filename: string }
    | { mode: 's3'; url: string }
  > {
    const artifact = await this.artifactRepo
      .createQueryBuilder('artifact')
      .addSelect(['artifact.storagePath', 'artifact.objectKey'])
      .where('artifact.id = :id', { id })
      .getOne();
    if (!artifact) throw new NotFoundException('Artifact not found');
    if (artifact.ownerId !== ownerId) throw new ForbiddenException();

    if (artifact.storageBackend === 's3') {
      if (!artifact.objectKey)
        throw new NotFoundException('Artifact object key is unavailable');
      const url = await this.storage.getSignedDownloadUrl(
        artifact.objectKey,
        artifact.filename || 'artifact',
      );
      return { mode: 's3', url };
    }

    const storageRoot = resolve(
      process.env.TRAINING_OUTPUT_ROOT ||
        resolve(process.cwd(), 'ml-tools/train/out/jobs'),
    );
    const storagePath = resolve(artifact.storagePath || '');
    if (!storagePath.startsWith(`${storageRoot}${sep}`)) {
      throw new ForbiddenException(
        'Artifact path is outside the configured output root',
      );
    }
    if (!artifact.storagePath || !existsSync(artifact.storagePath)) {
      throw new NotFoundException('Artifact file is unavailable');
    }
    return {
      mode: 'local',
      path: artifact.storagePath,
      filename: artifact.filename || basename(artifact.storagePath),
    };
  }

  private hashFile(path: string): Promise<string> {
    return new Promise((resolveHash, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(path);
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolveHash(hash.digest('hex')));
    });
  }

  findAll(ownerId: string, jobId?: string): Promise<Artifact[]> {
    const where: any = { ownerId };
    if (jobId) where.jobId = jobId;
    return this.artifactRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, ownerId: string): Promise<Artifact> {
    const a = await this.artifactRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Artifact not found');
    if (a.ownerId !== ownerId) throw new ForbiddenException();
    return a;
  }

  async scheduleQuantization(
    id: string,
    ownerId: string,
    format: 'gguf' | 'gptq' | 'awq' | 'fp8',
  ): Promise<Artifact> {
    const source = await this.findOne(id, ownerId);
    const newArtifact = this.artifactRepo.create({
      ownerId,
      jobId: source.jobId,
      modelName: source.modelName,
      baseModelId: source.baseModelId,
      format,
      status: 'quantizing',
      fileSizeGb: parseFloat((source.fileSizeGb * 0.28).toFixed(2)),
      quantBits: 4,
    });
    const saved = await this.artifactRepo.save(newArtifact);

    // Simulate quantization completing after 8s
    setTimeout(async () => {
      await this.artifactRepo.update(saved.id, {
        status: 'ready',
        downloadUrl: this.generateDownloadUrl(),
      });
    }, 8000);

    return saved;
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const artifact = await this.artifactRepo
      .createQueryBuilder('artifact')
      .addSelect('artifact.objectKey')
      .where('artifact.id = :id', { id })
      .getOne();
    if (!artifact) throw new NotFoundException('Artifact not found');
    if (artifact.ownerId !== ownerId) throw new ForbiddenException();
    if (artifact.storageBackend === 's3' && artifact.objectKey) {
      await this.storage.delete(artifact.objectKey);
    }
    await this.artifactRepo.delete(id);
  }

  async createJobArtifacts(
    ownerId: string,
    jobId: string,
    modelName: string,
    baseModelId: string,
    outputFormat: string,
  ): Promise<Artifact[]> {
    const sizeGb = 4.7;
    const created: Artifact[] = [];

    created.push(
      await this.create({
        ownerId,
        jobId,
        modelName,
        baseModelId,
        format: 'adapter',
        fileSizeGb: 0.03,
      }),
    );

    if (['merged', 'gguf', 'gptq'].includes(outputFormat)) {
      created.push(
        await this.create({
          ownerId,
          jobId,
          modelName,
          baseModelId,
          format: 'merged',
          fileSizeGb: sizeGb,
        }),
      );
    }
    if (outputFormat === 'gguf') {
      created.push(
        await this.create({
          ownerId,
          jobId,
          modelName,
          baseModelId,
          format: 'gguf',
          fileSizeGb: parseFloat((sizeGb * 0.28).toFixed(2)),
          quantBits: 4,
        }),
      );
    }
    if (outputFormat === 'gptq') {
      created.push(
        await this.create({
          ownerId,
          jobId,
          modelName,
          baseModelId,
          format: 'gptq',
          fileSizeGb: parseFloat((sizeGb * 0.25).toFixed(2)),
          quantBits: 4,
        }),
      );
    }
    if (outputFormat === 'fp8') {
      created.push(
        await this.create({
          ownerId,
          jobId,
          modelName,
          baseModelId,
          format: 'fp8',
          fileSizeGb: parseFloat((sizeGb * 0.5).toFixed(2)),
          quantBits: 8,
        }),
      );
    }
    return created;
  }

  private generateDownloadUrl(): string {
    const expires = new Date(Date.now() + 3600 * 1000).toISOString();
    return `https://storage.llmforge.io/artifacts/${Math.random().toString(36).slice(2)}?expires=${expires}`;
  }
}
