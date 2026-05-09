import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { createSandbox } from 'sinon';
import { MessageParser } from '../../src/services';

describe('MessageParser', () => {
  const sandbox = createSandbox();
  const parser = new MessageParser();

  beforeEach(() => {
    sandbox.restore();
  });

  describe('parse', () => {
    it('should handle when invoked with no messages', () => {
      const parsed = parser.parse();

      assert.strictEqual(parsed.length, 0);
    });

    it('should parse message when payload is of type inline', () => {
      const messages = [{
        MessageId: 'test-message-id',
        ReceiptHandle: 'test-receipt-handle',
        Body: JSON.stringify({ name: 'TestableEvent', payload: { key: 'value' } }),
        MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'INLINE' } }
      }];

      const parsed = parser.parse(messages);

      assert.strictEqual(parsed?.length, 1);
      assert.strictEqual(parsed[0]?.name, 'TestableEvent');
      assert.strictEqual(parsed[0]?.type, 'INLINE');
      assert.strictEqual(parsed[0]?.id, 'test-message-id');
      assert.strictEqual(parsed[0]?.handle, 'test-receipt-handle');
      assert.deepStrictEqual(parsed[0]?.payload, { key: 'value' });
    });

    it('should parse message when payload is of type reference', () => {
      const messages = [{
        MessageId: 'test-message-id',
        ReceiptHandle: 'test-receipt-handle',
        Body: JSON.stringify({ name: 'TestableEvent', pointer: 'testableevent/reference-001' }),
        MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'REFERENCE' } }
      }];

      const parsed = parser.parse(messages);

      assert.strictEqual(parsed?.length, 1);
      assert.strictEqual(parsed[0]?.name, 'TestableEvent');
      assert.strictEqual(parsed[0]?.type, 'REFERENCE');
      assert.strictEqual(parsed[0]?.id, 'test-message-id');
      assert.strictEqual(parsed[0]?.handle, 'test-receipt-handle');
      assert.strictEqual(parsed[0]?.pointer, 'testableevent/reference-001');
    });

    it('should skip messages with malformed payload', () => {
      const messages = [
        {
          MessageId: 'test-message-id',
          ReceiptHandle: 'test-receipt-handle',
          Body: JSON.stringify({ name: 'TestableEvent', payload: { key: 'value' } }),
          MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'INLINE' } }
        },
        {
          MessageId: 'test-message-id',
          ReceiptHandle: 'test-receipt-handle',
          Body: 'not-a-valid-json',
          MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'INLINE' } }
        },
        {
          MessageId: 'test-message-id',
          ReceiptHandle: 'test-receipt-handle',
          Body: JSON.stringify({ name: 'TestableEvent', pointer: 'testableevent/reference-001' }),
          MessageAttributes: { PayloadType: { DataType: 'String', StringValue: 'REFERENCE' } }
        }
      ];

      const parsed = parser.parse(messages);

      assert.strictEqual(parsed?.length, 2);
      assert.strictEqual(parsed[0]?.type, 'INLINE');
      assert.strictEqual(parsed[1]?.type, 'REFERENCE');
    });
  });
});