import { DeleteMessageCommand, type Message, ReceiveMessageCommand, type ReceiveMessageCommandInput, SQSClient } from '@aws-sdk/client-sqs';
import { loggerFor } from '../common';
import type { ParsedMessage, QueueConfig } from '../types';

const logger = loggerFor(import.meta.url);

class QueueClient {
  private readonly client: SQSClient;
  private readonly url: string;
  private readonly params?: Omit<ReceiveMessageCommandInput, 'QueueUrl'>;
  constructor({ url, params, config }: QueueConfig) {
    logger.info(`[~] initializing queue client for [${url}] with config:`, config);
    this.client = new SQSClient({ ...config });
    this.url = url;
    this.params = params;
  }

  public async receive(): Promise<Message[]> {
    logger.info('[~] receiving messages from queue');
    const command = new ReceiveMessageCommand({ QueueUrl: this.url, ...this.params });

    const { Messages: messages = [] } = await this.client.send(command);
    logger.info(`[+] received [${messages?.length || 0}] messages`);

    return messages;
  }

  public async delete(message: ParsedMessage): Promise<void> {
    const { handle, id } = message;

    logger.info(`[~] deleting message [${id}] from queue`);
    const command = new DeleteMessageCommand({ QueueUrl: this.url, ReceiptHandle: handle });

    await this.client.send(command);
    logger.info(`[+] deleted message [${id}]`);
  }
}

export { QueueClient };
