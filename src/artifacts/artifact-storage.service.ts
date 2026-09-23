import { Injectable, Logger } from '@nestjs/common';
import { createReadStream, statSync } from 'node:fs';
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';

/**
 * Real S3-compatible object storage for training artifacts, opt-in via
 * ARTIFACT_STORAGE_MODE=s3 (same explicit-opt-in pattern as
 * TRAINING_EXECUTION_MODE=local — no silent fallback to a real credentialed
 * backend). Talks to the AWS S3 wire protocol, so it works unmodified
 * against AWS S3, Cloudflare R2, or a self-hosted MinIO by pointing
 * ARTIFACT_STORAGE_ENDPOINT at it. When disabled, ArtifactsService keeps
 * using local disk + the authenticated /artifacts/:id/download route, as
 * before.
 */
@Injectable()
export class ArtifactStorageService {
  private readonly logger = new Logger(ArtifactStorageService.name);
  private client: S3Client | undefined;

  isEnabled(): boolean {
    return process.env.ARTIFACT_STORAGE_MODE === 's3';
  }

  private getBucket(): string {
    const bucket = process.env.ARTIFACT_STORAGE_BUCKET;
    if (!bucket) {
      throw new Error(
        'ARTIFACT_STORAGE_BUCKET is required when ARTIFACT_STORAGE_MODE=s3',
      );
    }
    return bucket;
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    const endpoint = process.env.ARTIFACT_STORAGE_ENDPOINT;
    const accessKeyId = process.env.ARTIFACT_STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.ARTIFACT_STORAGE_SECRET_ACCESS_KEY;
    this.client = new S3Client({
      region: process.env.ARTIFACT_STORAGE_REGION || 'us-east-1',
      ...(endpoint ? { endpoint } : {}),
      // MinIO/R2 need path-style addressing (bucket.example.com DNS routing
      // doesn't exist for them); real AWS S3 works with either.
      forcePathStyle: process.env.ARTIFACT_STORAGE_FORCE_PATH_STYLE === 'true',
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
    return this.client;
  }

  /** Streams a local file to the bucket under `key`. Uses @aws-sdk/lib-storage's
   * `Upload` helper, which buffers the stream into parts and automatically
   * switches to S3 multipart upload once the data crosses `partSize` — so a
   * merged full-fine-tune checkpoint past S3's 5GB single-PUT limit still
   * uploads correctly, while small artifacts still go out as a single PUT. */
  async upload(localPath: string, key: string): Promise<void> {
    const bucket = this.getBucket();
    const { size } = statSync(localPath);
    const upload = new Upload({
      client: this.getClient(),
      // 8 parts in flight at once, 8MB each — comfortably above the 5MB S3
      // minimum part size while keeping memory use for concurrent artifact
      // uploads bounded.
      queueSize: 8,
      partSize: 8 * 1024 * 1024,
      params: {
        Bucket: bucket,
        Key: key,
        Body: createReadStream(localPath),
      },
    });
    await upload.done();
    this.logger.log(`Uploaded ${localPath} (${size} bytes) to s3://${bucket}/${key}`);
  }

  /** Real expiring presigned GET URL — generated fresh on every call so it
   * never returns one that's already expired from a stored value. */
  async getSignedDownloadUrl(key: string, filename: string): Promise<string> {
    const ttlSeconds =
      Number(process.env.ARTIFACT_STORAGE_URL_TTL_SECONDS) || 3600;
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({
        Bucket: this.getBucket(),
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }),
      { expiresIn: ttlSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({ Bucket: this.getBucket(), Key: key }),
    );
  }
}
