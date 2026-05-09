import { S3Client } from '@aws-sdk/client-s3';
import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';
import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { createSandbox } from 'sinon';
import { Application, DomainEvent, EventPublisher } from '../../src/core';
import { EventAlreadyRegistered, QueueConfigUndefined, SchedulerConfigUndefined, StorageConfigUndefined, StorageReferenceUndefined } from '../../src/errors';
import type { ApplicationConfig } from '../../src/types';

describe('Application', () => {
  const sandbox = createSandbox();
  const stubs = {
    sns: sandbox.stub(), sqs: sandbox.stub(), s3: sandbox.stub(),
  };

  const config = {
    name: 'test-application',
    environment: 'development',
    topic: { arn: 'arn:aws:sns:us-east-1:123456789012:test-topic', config: { region: 'us-east-1' } },
    queue: { url: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue', config: { region: 'us-east-1' }, params: { MessageAttributeNames: ['All'] } },
    storage: { bucket: 'test-bucket', config: { region: 'us-east-1', forcePathStyle: true } },
    scheduler: { interval: 10_000 },
  } satisfies ApplicationConfig;

  beforeEach(() => {
    sandbox.restore();

    stubs.sns = sandbox.stub(SNSClient.prototype, 'send');
    stubs.sqs = sandbox.stub(SQSClient.prototype, 'send');
    stubs.s3 = sandbox.stub(S3Client.prototype, 'send');

    EventPublisher.reset();
  });

  class TestableEvent extends DomainEvent {
    constructor(payload: Record<string, unknown>) {
      super('TestableEvent', { ...payload, app: 'testable-service', category: 'testable-category' });
    }
  }

  describe('constructor', () => {
    it('should initialize with full config', () => {
      assert.doesNotThrow(() => new Application(config));
    });

    it('should initialize with minimal config', () => {
      const minimal = { name: 'minimal', environment: 'development' as const };
      assert.doesNotThrow(() => new Application(minimal));
    });
  });

  describe('on', () => {
    it('should register an event handler', () => {
      const app = new Application(config);
      const handler = sandbox.fake();

      assert.doesNotThrow(() => app.on('TestableEvent', handler));
    });

    it('should throw an error when registering a duplicate event', () => {
      const app = new Application(config);
      const handler = sandbox.fake();

      app.on('TestableEvent', handler);
      assert.throws(() => app.on('TestableEvent', handler), EventAlreadyRegistered);
    });

    it('should call handler with correct payload type', () => {
      type Events = { TestableEvent: { key: string; }; };
      const app = new Application<Events>(config);

      assert.doesNotThrow(() => app.on('TestableEvent', (payload) => {
        assert.strictEqual(payload.key, 'value');
      }));
    });
  });

  describe('register', () => {
    it('should register an event for publishing', () => {
      const app = new Application(config);

      assert.doesNotThrow(() => app.register('TestableEvent'));
    });

    it('should throw an error when registering a duplicate event', () => {
      const app = new Application(config);

      app.register('TestableEvent');
      assert.throws(() => app.register('TestableEvent'), EventAlreadyRegistered);
    });
  });

  describe('publish', () => {
    it('should publish inline payload when payload is not oversized', () => {
      const app = new Application(config);
      app.register('TestableEvent');

      stubs.sns.resolves({ MessageId: 'test-message-id' });
      EventPublisher.emit(new TestableEvent({ key: 'value' }));

      const command = stubs.sns.getCall(0).args[0];
      const { input: { MessageAttributes, Message } } = command;

      assert.strictEqual(Message, JSON.stringify({ 'name': 'TestableEvent', 'payload': { 'key': 'value' } }));
      assert.strictEqual(MessageAttributes.PayloadType.StringValue, 'INLINE');
    });

    it('should publish a reference payload when payload is oversized', async () => {
      const app = new Application(config);
      app.register('TestableEvent');

      stubs.s3.resolves({});
      stubs.sns.resolves({ MessageId: 'test-message-id' });

      EventPublisher.emit(new TestableEvent({ key: 'value x. '.repeat(30 * 1024) }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      const s3Command = stubs.s3.getCall(0).args[0];
      const snsCommand = stubs.sns.getCall(0).args[0];

      const { input: { Bucket, Key } } = s3Command;
      const { input: { MessageAttributes, Message } } = snsCommand;

      assert.strictEqual(Bucket, config.storage.bucket);
      assert.ok(Key.startsWith('testableevent/'));

      assert.ok(JSON.parse(Message).pointer);
      assert.strictEqual(MessageAttributes.PayloadType.StringValue, 'REFERENCE');
    });

    it('should throw an error when topic is not configured', () => {
      const app = new Application({ ...config, topic: undefined });

      app.register('TestableEvent');
      EventPublisher.emit(new TestableEvent({ key: 'value' }));

      assert.strictEqual(stubs.sns.callCount, 0);
    });

    it('should throw an error when payload is oversized and storage is not configured', () => {
      const app = new Application({ ...config, storage: undefined });

      app.register('TestableEvent');
      EventPublisher.emit(new TestableEvent({ key: 'value x. '.repeat(30 * 1024) }));

      assert.strictEqual(stubs.s3.callCount, 0);
      assert.strictEqual(stubs.sns.callCount, 0);
    });
  });

  describe('start', () => {
    it('should start the scheduler', () => {
      const app = new Application(config);

      assert.doesNotReject(() => app.start());
      app.stop();
    });

    it('should throw an error when scheduler is not configured', () => {
      const app = new Application({ ...config, scheduler: undefined });

      assert.rejects(() => app.start(), SchedulerConfigUndefined);
    });
  });

  describe('resolve', () => {
    it('should resolve inline payload', async () => {
      const app = new Application({ ...config, scheduler: { interval: 10 } });
      const handler = sandbox.fake();

      app.on('TestableEvent', handler);

      stubs.sqs.resolves({
        Messages: [{
          MessageId: 'test-message-id',
          ReceiptHandle: 'test-receipt-handle',
          Body: JSON.stringify({ name: 'TestableEvent', payload: { key: 'value' } }),
          MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'INLINE' } }
        }]
      });

      await app.start();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await app.stop();

      assert.ok(handler.calledOnce);
      assert.deepStrictEqual(handler.getCall(0).args[0], { key: 'value' });
    });

    it('should resolve reference payload', async () => {
      const app = new Application({ ...config, scheduler: { interval: 10 } });
      const handler = sandbox.fake();

      app.on('TestableEvent', handler);

      stubs.s3.resolves({
        Body: { transformToString: () => Promise.resolve(JSON.stringify({ key: 'value' })) },
      });

      stubs.sqs.resolves({
        Messages: [{
          MessageId: 'test-message-id',
          ReceiptHandle: 'test-receipt-handle',
          Body: JSON.stringify({ name: 'TestableEvent', pointer: 'testableevent/reference-001' }),
          MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'REFERENCE' } }
        }]
      });

      await app.start();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await app.stop();

      assert.ok(handler.calledOnce);
      assert.deepStrictEqual(handler.getCall(0).args[0], { key: 'value' });
    });

    it('should throw an error when resolving reference without storage', async () => {
      const app = new Application({ ...config, storage: undefined, scheduler: { interval: 10 } });
      const handler = sandbox.fake();

      app.on('TestableEvent', handler);

      stubs.sqs.resolves({
        Messages: [{
          MessageId: 'test-message-id',
          ReceiptHandle: 'test-receipt-handle',
          Body: JSON.stringify({ name: 'TestableEvent', pointer: 'testableevent/reference-001' }),
          MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'REFERENCE' } }
        }]
      });

      await app.start();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await app.stop();

      const parsed = {
        name: 'TestableEvent', pointer: 'testableevent/reference-001', type: 'REFERENCE', id: 'test-message-id', handle: 'test-receipt-handle',
      };

      assert.strictEqual(handler.callCount, 0);
      assert.rejects(() => app['resolve'](parsed), StorageConfigUndefined);
    });

    it('should throw an error when resolving reference without pointer', async () => {
      const app = new Application({ ...config, scheduler: { interval: 10 } });
      const handler = sandbox.fake();

      app.on('TestableEvent', handler);

      stubs.sqs.resolves({
        Messages: [{
          MessageId: 'test-message-id',
          ReceiptHandle: 'test-receipt-handle',
          Body: JSON.stringify({ name: 'TestableEvent', pointer: 'testableevent/reference-001' }),
          MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'REFERENCE' } }
        }]
      });

      await app.start();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await app.stop();

      const parsed = {
        name: 'TestableEvent', type: 'REFERENCE', id: 'test-message-id', handle: 'test-receipt-handle',
      };

      assert.strictEqual(handler.callCount, 0);
      assert.rejects(() => app['resolve'](parsed), StorageReferenceUndefined);
    });
  });

  describe('poll', () => {
    it('should poll for messages from queue', async () => {
      const app = new Application({ ...config, scheduler: { interval: 10 } });
      const handler = sandbox.fake();

      app.on('TestableEvent', handler);

      stubs.sqs.resolves({
        Messages: [{
          MessageId: 'test-message-id',
          ReceiptHandle: 'test-receipt-handle',
          Body: JSON.stringify({ name: 'TestableEvent', payload: { key: 'value' } }),
          MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'INLINE' } }
        }]
      });

      await app.start();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await app.stop();

      assert.ok(handler.called);
      assert.deepStrictEqual(handler.getCall(0).args[0], { key: 'value' });
    });

    it('should skip messages when no handler is registered', async () => {
      const app = new Application({ ...config, scheduler: { interval: 10 } });
      const handler = sandbox.fake();

      app.on('TestableEvent', handler);

      stubs.sqs.resolves({
        Messages: [{
          MessageId: 'test-message-id',
          ReceiptHandle: 'test-receipt-handle',
          Body: JSON.stringify({ name: 'UnknownEvent', payload: { key: 'value' } }),
          MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'INLINE' } }
        }]
      });

      await app.start();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await app.stop();

      assert.strictEqual(handler.callCount, 0);
    });

    it('should isolate handler errors', async () => {
      type Events = { TestableEvent: { key: string; }; };
      const app = new Application<Events>({ ...config, scheduler: { interval: 10 } });
      const handler = sandbox.fake();

      app.on('TestableEvent', async (payload) => {
        if (payload.key === 'error') throw new Error('handler failure');
        else handler(payload);
      });

      stubs.sqs.resolves({
        Messages: [
          {
            MessageId: 'test-message-id',
            ReceiptHandle: 'test-receipt-handle',
            Body: JSON.stringify({ name: 'TestableEvent', payload: { key: 'error' } }),
            MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'INLINE' } }
          },
          {
            MessageId: 'test-message-id',
            ReceiptHandle: 'test-receipt-handle',
            Body: JSON.stringify({ name: 'TestableEvent', payload: { key: 'not-error' } }),
            MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'INLINE' } }
          }
        ]
      });

      await app.start();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await app.stop();

      assert.ok(handler.calledOnce);
      assert.deepStrictEqual(handler.getCall(0).args[0], { key: 'not-error' });
    });

    it('should delete messages from queue when successfully handled', async () => {
      const app = new Application({ ...config, scheduler: { interval: 10 } });
      const handler = sandbox.fake();

      app.on('TestableEvent', handler);

      stubs.sqs.resolves({
        Messages: [{
          MessageId: 'test-message-id',
          ReceiptHandle: 'test-receipt-handle',
          Body: JSON.stringify({ name: 'TestableEvent', payload: { key: 'value' } }),
          MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'INLINE' } }
        }]
      });

      await app.start();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await app.stop();

      const command = stubs.sqs.getCall(1).args[0];
      const { input: { ReceiptHandle } } = command;

      assert.strictEqual(ReceiptHandle, 'test-receipt-handle');
    });

    it('should throw an error when queue is not configured', async () => {
      const app = new Application({ ...config, queue: undefined });

      assert.rejects(() => app['poll'](), QueueConfigUndefined);
    });
  });

  describe('stop', () => {
    it('should stop without error', () => {
      const app = new Application(config);

      assert.doesNotReject(() => app.stop());
    });

    it('should be safe to call multiple times', () => {
      const app = new Application(config);

      assert.doesNotThrow(() => app.stop());
      assert.doesNotThrow(() => app.stop());
    });
  });
});