import { v7 as uuid } from 'uuid';
import type { DomainEventPayload } from '../types';

class DomainEvent<PayloadType = DomainEventPayload> {
  public readonly id: string;
  public readonly name: string;
  public readonly payload: PayloadType;
  public readonly timestamp: number;

  constructor(name: string, payload = {} as PayloadType) {
    this.id = uuid();
    this.name = name;
    this.payload = payload;
    this.timestamp = Date.now();
  }
}

export { DomainEvent };
