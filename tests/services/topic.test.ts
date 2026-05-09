import { SNSClient } from '@aws-sdk/client-sns';
import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { createSandbox } from 'sinon';
import { TopicClient } from '../../src/services';

describe('TopicClient', () => {
  const sandbox = createSandbox();
  const stubs = { sns: sandbox.stub() };

  const config = {
    arn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
    config: { region: 'us-east-1' },
    params: { MessageGroupId: 'test-group' }
  };

  beforeEach(() => {
    sandbox.restore();
    stubs.sns = sandbox.stub(SNSClient.prototype, 'send');
  });

  describe('constructor', () => {
    it('should initialize with full config', () => {
      assert.doesNotThrow(() => new TopicClient(config));
    });

    it('should initialize with minimal config', () => {
      const minimal = { ...config, config: {}, params: undefined };
      assert.doesNotThrow(() => new TopicClient(minimal));
    });
  });

  describe('oversized', () => {
    it('should identify oversized messages', () => {
      const client = new TopicClient(config);

      const payload = 'value x. '.repeat(30 * 1024);
      const oversized = client.oversized(payload);

      assert.strictEqual(oversized, true);
    });

    it('should identify normal sized messages', () => {
      const client = new TopicClient(config);

      const payload = 'value x. '.repeat(10 * 1024);
      const oversized = client.oversized(payload);

      assert.strictEqual(oversized, false);
    });
  });

  describe('publish', () => {
    it('should publish a message on the topic', async () => {
      const client = new TopicClient(config);

      stubs.sns.resolves({ MessageId: 'test-message-id' });
      const message = JSON.stringify({ key: 'value' });

      await client.publish(message);

      const command = stubs.sns.getCall(0).args[0];
      const { input: { Message, MessageGroupId, TopicArn } } = command;

      assert.strictEqual(stubs.sns.callCount, 1);
      assert.strictEqual(Message, message);
      assert.strictEqual(MessageGroupId, 'test-group');
      assert.strictEqual(TopicArn, config.arn);
    });

    it('should merge default params with provided params', async () => {
      const params = { MessageDeduplicationId: 'test-deduplication-id' };
      const client = new TopicClient({ ...config, params: { ...config.params, ...params } });

      stubs.sns.resolves({ MessageId: 'test-message-id' });
      const message = JSON.stringify({ key: 'value' });

      await client.publish(message);

      const command = stubs.sns.getCall(0).args[0];
      const { input: { Message, MessageGroupId, MessageDeduplicationId } } = command;

      assert.strictEqual(stubs.sns.callCount, 1);
      assert.strictEqual(Message, message);
      assert.strictEqual(MessageGroupId, 'test-group');
      assert.strictEqual(MessageDeduplicationId, 'test-deduplication-id');
    });
  });
});