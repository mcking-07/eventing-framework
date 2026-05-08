import type { GenericPayloadType, UnknownMap } from './common';
import type { QueueConfig, SchedulerConfig, StorageConfig, TopicConfig } from './services';

type Environment = 'development' | 'production' | 'staging';

type ApplicationConfig = {
  name: string;
  environment: Environment;
  topic?: TopicConfig;
  queue?: QueueConfig;
  storage?: StorageConfig;
  scheduler?: SchedulerConfig;
};

type DomainEventMetaData = {
  app: string;
  category: string;
}

type DomainEventPayload = DomainEventMetaData & UnknownMap;

type EventHandler<EventType> = (event: EventType) => void;

type HandlerType<PayloadType = GenericPayloadType> = (payload: PayloadType) => Promise<void> | void;

export type { ApplicationConfig, DomainEventPayload, Environment, EventHandler, HandlerType };
