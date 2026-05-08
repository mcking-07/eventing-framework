import type { Message } from '@aws-sdk/client-sqs';
import type { ParsedMessage } from '../types';
import { loggerFor, safe } from '../common';

const logger = loggerFor(import.meta.url);

class MessageParser {
  public parse(messages: Message[] = []): ParsedMessage[] {
    logger.info(`[~] parsing [${messages?.length || 0}] messages`);
    return messages.map((message: Message) => {
      const { Body: body = '{}', MessageAttributes: attributes, MessageId: id, ReceiptHandle: handle } = message;

      const [error, parsed] = safe(() => JSON.parse(body))();

      if (error || !parsed || typeof parsed !== 'object') {
        logger.warn(`[!] skipping invalid message [${id}] with ${error ? error.message : 'non-object body'}`);
        return null;
      }

      const type = attributes?.PayloadType?.StringValue;
      logger.info(`[+] parsed message [${id}] with payload type [${type}]`);

      return { ...parsed, handle, id, type };
    }).filter(Boolean);
  }
}

export { MessageParser };
