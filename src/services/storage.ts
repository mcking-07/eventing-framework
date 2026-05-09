import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v7 as uuid } from 'uuid';
import { loggerFor, safe } from '../common';
import { EmptyResponseFromStore } from '../errors';
import type { StorageConfig, StoragePayload } from '../types';

const logger = loggerFor(import.meta.url);

class ObjectStore {
  private readonly client: S3Client;
  private readonly bucket: string;
  constructor({ bucket, config }: StorageConfig) {
    logger.info(`[~] initializing object store client for bucket [${bucket}] with config:`, config);
    this.client = new S3Client({ ...config });
    this.bucket = bucket;
  }

  public async get(key: string): Promise<StoragePayload> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    logger.info(`[~] fetching object for key [${key}]`);

    const [error, response] = await safe(async () => this.client.send(command))();

    if (error || !response) {
      logger.error(`[!] failed to fetch object from store for key [${key}] from bucket [${this.bucket}] with ${error?.message || 'unknown error'}`);
      throw new EmptyResponseFromStore(`failed to fetch object from store for key [${key}] from bucket [${this.bucket}]`, { error });
    }

    const { Body: body } = response;
    const payload = await body?.transformToString();

    if (!payload) {
      logger.error(`[!] empty response for key [${key}] from bucket [${this.bucket}]`);
      throw new EmptyResponseFromStore(`empty response for key [${key}] from bucket [${this.bucket}]`);
    }

    logger.info(`[+] fetched object for key [${key}]`);
    return JSON.parse(payload);
  }

  public async put(prefix: string, payload: StoragePayload): Promise<string> {
    const key = `${prefix.toLowerCase()}/${uuid()}`;
    logger.info(`[~] storing object for key [${key}]`);

    const command = new PutObjectCommand({ Body: JSON.stringify(payload), Bucket: this.bucket, ContentType: 'application/json', Key: key });
    await this.client.send(command);

    logger.info(`[+] stored object for key [${key}]`);
    return key;
  }
}

export { ObjectStore };
