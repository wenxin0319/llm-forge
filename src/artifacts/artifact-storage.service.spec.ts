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
});
