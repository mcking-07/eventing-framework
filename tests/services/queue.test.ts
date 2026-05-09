import { SQSClient } from '@aws-sdk/client-sqs';
import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { createSandbox } from 'sinon';
import { QueueClient } from '../../src/services';

describe('QueueClient', () => {
  const sandbox = createSandbox();
  const stubs = { sqs: sandbox.stub() };

  const config = {
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
    config: { region: 'us-east-1' },
    params: { MessageAttributeNames: ['All'] }
  };

  beforeEach(() => {
    sandbox.restore();
    stubs.sqs = sandbox.stub(SQSClient.prototype, 'send');
  });

  describe('constructor', () => {
    it('should initialize with full config', () => {
      assert.doesNotThrow(() => new QueueClient(config));
    });

    it('should initialize with minimal config', () => {
      const minimal = { ...config, config: {}, params: undefined };
      assert.doesNotThrow(() => new QueueClient(minimal));
    });
  });

  describe('receive', () => {
    it('should receive messages from queue', async () => {
      const client = new QueueClient(config);

      stubs.sqs.resolves({
        Messages: [
          {
            MessageId: 'test-message-id',
            ReceiptHandle: 'test-receipt-handle',
            Body: JSON.stringify({ name: 'TestableEvent', payload: { key: 'value' } }),
            MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'INLINE' } }
          },
          {
            MessageId: 'test-message-id',
            ReceiptHandle: 'test-receipt-handle',
            Body: JSON.stringify({ name: 'TestableEvent', pointer: 'testableevent/reference-001' }),
            MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'REFERENCE' } }
          }
        ]
      });

      const messages = await client.receive();

      assert.strictEqual(messages.length, 2);
      assert.strictEqual(stubs.sqs.callCount, 1);
      assert.strictEqual(messages[0]?.MessageId, 'test-message-id');
      assert.strictEqual(messages[0]?.ReceiptHandle, 'test-receipt-handle');
    });

    it('should handle when no messages are available', async () => {
      const client = new QueueClient(config);
      stubs.sqs.resolves({ Messages: [] });

      const messages = await client.receive();

      assert.strictEqual(messages.length, 0);
      assert.strictEqual(stubs.sqs.callCount, 1);
    });
  });

  describe('delete', () => {
    it('should delete messages from queue', async () => {
      const client = new QueueClient(config);
      stubs.sqs.resolves({});

      const message = {
        id: 'test-message-id', handle: 'test-receipt-handle', name: 'TestableEvent', type: 'INLINE', payload: { key: 'value' },
      };

      await client.delete(message);
      const command = stubs.sqs.getCall(0).args[0];
      const { input: { QueueUrl, ReceiptHandle } } = command;

      assert.strictEqual(stubs.sqs.callCount, 1);
      assert.strictEqual(QueueUrl, config.url);
      assert.strictEqual(ReceiptHandle, message.handle);
    });
  });
});