import { S3Client } from '@aws-sdk/client-s3';
import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { createSandbox } from 'sinon';
import { ObjectStore } from '../../src/services';
import { EmptyResponseFromStore } from '../../src/errors';

describe('ObjectStore', () => {
  const sandbox = createSandbox();
  const stubs = { s3: sandbox.stub() };

  const config = {
    bucket: 'test-bucket',
    config: { region: 'us-east-1', forcePathStyle: true },
  };

  beforeEach(() => {
    sandbox.restore();
    stubs.s3 = sandbox.stub(S3Client.prototype, 'send');
  });

  describe('constructor', () => {
    it('should initialize with full config', () => {
      assert.doesNotThrow(() => new ObjectStore(config));
    });

    it('should initialize with minimal config', () => {
      const minimal = { ...config, config: {} };
      assert.doesNotThrow(() => new ObjectStore(minimal));
    });
  });

  describe('get', () => {
    it('should retrieve an object from the store', async () => {
      const client = new ObjectStore(config);
      const key = 'testableevent/reference-001';

      stubs.s3.resolves({
        Body: {
          transformToString: () => Promise.resolve('{ "key": "value" }')
        }
      });

      const payload = await client.get(key);

      assert.strictEqual(stubs.s3.callCount, 1);
      assert.deepStrictEqual(payload, { key: 'value' });
    });

    it('should throw an error if the object is not found', () => {
      const client = new ObjectStore(config);
      const key = 'non-existent-key';

      stubs.s3.rejects(new Error('NoSuchKey: The specified key does not exist.'));

      assert.rejects(() => client.get(key), EmptyResponseFromStore);
    });

    it('should throw an error if the body is empty', () => {
      const client = new ObjectStore(config);
      const key = 'empty-key';

      stubs.s3.resolves({
        Body: {
          transformToString: () => Promise.resolve('')
        }
      });

      assert.rejects(() => client.get(key), EmptyResponseFromStore);
    });
  });

  describe('put', () => {
    it('should store an object in the store', async () => {
      const client = new ObjectStore(config);

      const prefix = 'testableevent';
      const payload = { key: 'value' };

      stubs.s3.resolves({});
      const key = await client.put(prefix, payload);

      assert.ok(key.length > 36);
      assert.strictEqual(typeof key, 'string');
      assert.strictEqual(stubs.s3.callCount, 1);
    });
  });
});