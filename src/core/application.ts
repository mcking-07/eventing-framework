import { loggerFor } from '../common';
import { EventAlreadyRegistered, QueueConfigUndefined, SchedulerConfigUndefined, StorageConfigUndefined, StorageReferenceUndefined, TopicConfigUndefined } from '../errors';
import { MessageParser, ObjectStore, QueueClient, TaskScheduler, TopicClient } from '../services';
import type { ApplicationConfig, Environment, GenericPayloadType, HandlerType, ParsedMessage } from '../types';
import type { DomainEvent } from './domain';
import { EventPublisher } from './publisher';

const logger = loggerFor(import.meta.url);

const APP_NAME_UNDEFINED = 'APP_NAME_UNDEFINED';
const CATEGORY_UNDEFINED = 'CATEGORY_UNDEFINED';

class Application<Events extends Record<string, GenericPayloadType>> {
  private readonly name: string;
  private readonly environment: Environment;
  private readonly topic?: TopicClient;
  private readonly queue?: QueueClient;
  private readonly storage?: ObjectStore;
  private readonly scheduler?: TaskScheduler;
  private readonly message: MessageParser;
  private readonly handlers: Map<string, HandlerType>;
  private readonly registered: Set<string>;

  constructor(public readonly config: ApplicationConfig) {
    this.name = config.name;
    this.environment = config.environment;

    logger.info(`[~] initializing application [${this.name}] in [${this.environment}] mode`);

    this.topic = config.topic ? new TopicClient(config.topic) : undefined;
    this.queue = config.queue ? new QueueClient(config.queue) : undefined;
    this.storage = config.storage ? new ObjectStore(config.storage) : undefined;
    this.scheduler = config.scheduler ? new TaskScheduler(config.scheduler) : undefined;

    this.message = new MessageParser();
    this.handlers = new Map<string, HandlerType>();
    this.registered = new Set<string>();
  }

  public on<Event extends keyof Events>(event: Event, handler: HandlerType<Events[Event]>): void;
  public on<PayloadType>(event: string, handler: HandlerType<PayloadType>): void;
  public on<PayloadType>(event: string, handler: HandlerType<PayloadType>): void {
    if (this.handlers.has(event)) {
      logger.error(`[-] event [${event}] is already registered for consumption in [${this.name}] application`);
      throw new EventAlreadyRegistered(`event [${event}] is already registered for consumption in [${this.name}] application`);
    }

    logger.info(`[~] registering event [${event}] for consumption`);
    this.handlers.set(event, handler as HandlerType);
  }

  public register(event: string): void {
    if (this.registered.has(event)) {
      logger.error(`[-] event [${event}] is already registered for publication in [${this.name}] application`);
      throw new EventAlreadyRegistered(`event [${event}] is already registered for publication in [${this.name}] application`);
    }

    logger.info(`[~] registering event [${event}] for publication`);
    EventPublisher.on(event, this.emit.bind(this));
    this.registered.add(event);
  }

  private prepare(event: DomainEvent) {
    const { name, payload: { app = APP_NAME_UNDEFINED, category = CATEGORY_UNDEFINED, ...payload } = {} } = event || {};
    const metadata = { App: app, Category: category, EventName: name };

    logger.info(`[~] preparing event [${name}] for emission`);
    return { metadata, name, payload };
  }

  private async dispatch(event: DomainEvent): Promise<void> {
    if (!this.topic) {
      logger.error(`[!] topic client not configured for [${this.name}] application, cannot emit event`);
      throw new TopicConfigUndefined(`topic configs undefined for [${this.name}] application`, { event });
    }

    if (!this.storage) {
      logger.error(`[!] storage client not configured for [${this.name}] application, cannot emit event with large payload`);
      throw new StorageConfigUndefined(`storage configs undefined for [${this.name}] application`, { event });
    }

    const { name, payload = {}, metadata } = this.prepare(event);

    if (this.topic.oversized(payload)) {
      logger.info(`[~] oversized payload detected for event [${name}], storing in object store`);
      const pointer = await this.storage.put(name, payload);

      const message = JSON.stringify({ name, pointer });
      await this.topic.publish(message, { ...metadata, PayloadType: 'REFERENCE' });

      logger.info(`[+] published event [${name}] with payload reference [${pointer}]`);
      return;
    }

    const message = JSON.stringify({ name, payload });
    await this.topic.publish(message, { ...metadata, PayloadType: 'INLINE' });

    logger.info(`[+] published event [${name}] with inline payload`);
  }

  private emit(event: DomainEvent): void {
    this.dispatch(event).catch((error: Error) => logger.error(`[!] dispatch failed for event [${event.name}]:`, error));
  }

  private async resolve(message: ParsedMessage) {
    const { name, payload, pointer, type } = message;

    if (type === 'INLINE') {
      logger.info(`[~] using inline payload for event [${name}]`);
      return payload;
    }

    if (!this.storage) {
      logger.error(`[!] storage client not configured for [${this.name}] application, cannot resolve reference`);
      throw new StorageConfigUndefined(`storage configs undefined for [${this.name}] application`);
    }

    if (!pointer) {
      logger.error(`[!] missing storage reference for event [${name}] in message, cannot resolve reference`);
      throw new StorageReferenceUndefined(`storage reference undefined for event [${name}] in message`);
    }

    logger.info(`[~] resolving storage reference [${pointer}] for event [${name}]`);
    return await this.storage.get(pointer);
  }

  private async poll(): Promise<void> {
    if (!this.queue) {
      logger.error(`[!] queue client not configured for [${this.name}] application, cannot poll`);
      throw new QueueConfigUndefined(`queue configs undefined for [${this.name}] application`);
    }

    const messages = await this.queue.receive();
    const parsed = this.message.parse(messages);

    logger.info(`[~] processing [${parsed.length}] messages from queue for [${this.name}] application`);

    for (const message of parsed) {
      try {
        const payload = await this.resolve(message);
        const { name } = message;

        const handler = this.handlers.get(name);
        if (!handler) {
          logger.warn(`[-] no handler found for event [${name}]`);
          continue;
        }

        logger.info(`[~] executing handler for event [${name}]`);
        await handler(payload);

        logger.info(`[+] executed handler for event [${name}], deleting message from queue`);
        await this.queue.delete(message);
      } catch (error) {
        logger.error(`[!] handler invocation failed for event [${message.name}]`, error);
      }
    }

    logger.info(`[+] completed processing messages from queue for [${this.name}] application`);
  }

  public async start(): Promise<void> {
    if (!this.scheduler) {
      logger.error(`[!] scheduler not configured for [${this.name}] application, cannot start`);
      throw new SchedulerConfigUndefined(`scheduler configs undefined for [${this.name}] application`);
    }

    logger.info(`[~] starting application [${this.name}] in [${this.environment}] mode`);
    this.scheduler.schedule(this.name, () => this.poll());
  }

  public async stop(): Promise<void> {
    logger.info(`[~] stopping application [${this.name}]`);

    EventPublisher.reset();
    this.registered.clear();

    this.handlers.clear();
    this.scheduler?.stop();
  }
}

export { Application };
