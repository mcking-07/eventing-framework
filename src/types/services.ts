import type { S3ClientConfig } from '@aws-sdk/client-s3';
import type { MessageAttributeValue, PublishCommandInput, SNSClientConfig } from '@aws-sdk/client-sns';
import type { ReceiveMessageCommandInput, SQSClientConfig } from '@aws-sdk/client-sqs';
import type { StringMap, UnknownMap } from './common';

type TopicConfig = {
  arn: string;
  config: SNSClientConfig;
  params?: Omit<PublishCommandInput, 'TopicArn' | 'Message'>;
};

type QueueConfig = {
  url: string;
  config: SQSClientConfig;
  params?: Omit<ReceiveMessageCommandInput, 'QueueUrl'>;
};

type StorageConfig = {
  bucket: string;
  config: S3ClientConfig;
};

type SchedulerConfig = {
  interval: number;
};

type ParsedMessage = {
  name: string;
  payload?: unknown;
  pointer?: string;
  type?: string;
  id: string;
  handle: string;
};

type PreMessageAttributes = StringMap;

type MessageAttributes = Record<string, MessageAttributeValue>;

type StoragePayload = UnknownMap;

type TaskType = (...args: unknown[]) => Promise<unknown>;

export type { MessageAttributes, ParsedMessage, PreMessageAttributes, QueueConfig, SchedulerConfig, StorageConfig, StoragePayload, TaskType, TopicConfig };
