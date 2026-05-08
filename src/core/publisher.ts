import EventEmitter from 'node:events';
import { loggerFor } from '../common';
import type { DomainEvent } from './domain';
import type { EventHandler } from '../types';

const logger = loggerFor(import.meta.url);

class EventPublisher {
  public static emitter = new EventEmitter();

  public static emit<EventType extends DomainEvent>(event: EventType) {
    this.emitter.emit(event.name, event);
  }

  public static on<EventType extends DomainEvent>(event: string, listener: EventHandler<EventType>) {
    this.emitter.on(event, this.wrapped(listener));
  }

  public static reset() {
    this.emitter = new EventEmitter();
  }

  private static wrapped = <EventType extends DomainEvent>(handler: EventHandler<EventType>) => (event: EventType) => {
    logger.info(`[~] received event [${event.name}] with payload:`, event?.payload);
    return handler(event);
  };
}

export { EventPublisher };
