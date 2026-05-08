import { PublishCommand, type PublishCommandInput, SNSClient } from '@aws-sdk/client-sns';
import { loggerFor } from '../common';
import type { MessageAttributes, PreMessageAttributes, TopicConfig } from '../types';

const logger = loggerFor(import.meta.url);

class TopicClient {
  private readonly client: SNSClient;
  private readonly arn: string;
  private readonly params?: Omit<PublishCommandInput, 'TopicArn' | 'Message'>;
  private readonly MAX_PAYLOAD_SIZE = 256 * 1024;
  constructor({ arn, params, config }: TopicConfig) {
    logger.info(`[~] initializing topic client for [${arn}] with config:`, config);
    this.client = new SNSClient({ ...config });
    this.arn = arn;
    this.params = params;
  }

  public oversized(payload: unknown) {
    return Buffer.byteLength(JSON.stringify(payload), 'utf8') > this.MAX_PAYLOAD_SIZE;
  }

  private attributes(records: PreMessageAttributes) {
    return Object.entries(records).reduce<MessageAttributes>((attrs, [key, value]) => ({
      ...attrs, [key]: { DataType: 'String', StringValue: value }
    }), {});
  }

  public async publish(message: string, metadata: PreMessageAttributes = {}) {
    logger.info('[~] publishing message to topic with metadata:', metadata);

    const command = new PublishCommand({
      ...this.params, Message: message, MessageAttributes: { ...this.params?.MessageAttributes, ...this.attributes(metadata) }, TopicArn: this.arn,
    });

    const { MessageId: id } = await this.client.send(command);
    logger.info(`[+] published message [${id}]`);
  }
}

export { TopicClient };
