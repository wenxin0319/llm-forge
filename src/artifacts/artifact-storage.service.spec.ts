import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { ArtifactStorageService } from './artifact-storage.service';

describe('ArtifactStorageService', () => {
  const keys = [
    'ARTIFACT_STORAGE_MODE',
    'ARTIFACT_STORAGE_BUCKET',
    'ARTIFACT_STORAGE_REGION',
    'ARTIFACT_STORAGE_ENDPOINT',
    'ARTIFACT_STORAGE_FORCE_PATH_STYLE',
    'ARTIFACT_STORAGE_ACCESS_KEY_ID',
    'ARTIFACT_STORAGE_SECRET_ACCESS_KEY',
  ] as const;
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) original[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of keys) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it('is disabled unless ARTIFACT_STORAGE_MODE=s3 is explicitly set', () => {
    delete process.env.ARTIFACT_STORAGE_MODE;
    expect(new ArtifactStorageService().isEnabled()).toBe(false);
    process.env.ARTIFACT_STORAGE_MODE = 's3';
    expect(new ArtifactStorageService().isEnabled()).toBe(true);
  });

  it('refuses to upload when the bucket is not configured', async () => {
    process.env.ARTIFACT_STORAGE_MODE = 's3';
    delete process.env.ARTIFACT_STORAGE_BUCKET;
    const service = new ArtifactStorageService();

    await expect(service.upload('/tmp/does-not-matter', 'key')).rejects.toThrow(
      'ARTIFACT_STORAGE_BUCKET is required',
    );
  });

  describe('upload (multipart)', () => {
    let dir: string;
    const sendSpy = jest.spyOn(S3Client.prototype, 'send');

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-forge-artifact-storage-test-'));
      process.env.ARTIFACT_STORAGE_MODE = 's3';
      process.env.ARTIFACT_STORAGE_BUCKET = 'test-bucket';
      sendSpy.mockReset();
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    afterAll(() => {
      sendSpy.mockRestore();
    });

    it('uploads a small file as a single PutObject, not multipart', async () => {
      sendSpy.mockImplementation(async (command: unknown) => {
        if (command instanceof PutObjectCommand) return { ETag: '"abc"' };
        throw new Error(`unexpected S3 command: ${(command as { constructor: { name: string } }).constructor.name}`);
      });
      const file = path.join(dir, 'small.bin');
      fs.writeFileSync(file, Buffer.alloc(1024, 1));

      await new ArtifactStorageService().upload(file, 'artifacts/small.bin');

      const commands = sendSpy.mock.calls.map(([c]) => (c as { constructor: { name: string } }).constructor.name);
      expect(commands).toEqual(['PutObjectCommand']);
    });

    it('switches to real S3 multipart upload once the file exceeds partSize', async () => {
      sendSpy.mockImplementation(async (command: unknown) => {
        if (command instanceof CreateMultipartUploadCommand) return { UploadId: 'upload-1' };
        if (command instanceof UploadPartCommand)
          return { ETag: `"part-${(command as UploadPartCommand).input.PartNumber}"` };
        if (command instanceof CompleteMultipartUploadCommand) return { Location: 's3://test-bucket/big.bin' };
        throw new Error(`unexpected S3 command: ${(command as { constructor: { name: string } }).constructor.name}`);
      });

      const file = path.join(dir, 'big.bin');
      // Larger than the service's 8MB partSize, so lib-storage must split it
      // into real multipart UploadPart calls instead of one PutObject.
      fs.writeFileSync(file, Buffer.alloc(9 * 1024 * 1024, 2));

      await new ArtifactStorageService().upload(file, 'artifacts/big.bin');

      const commands = sendSpy.mock.calls.map(([c]) => (c as { constructor: { name: string } }).constructor.name);
      expect(commands[0]).toBe('CreateMultipartUploadCommand');
      expect(commands.filter((c) => c === 'UploadPartCommand').length).toBeGreaterThanOrEqual(2);
      expect(commands[commands.length - 1]).toBe('CompleteMultipartUploadCommand');
    });
  });
});
