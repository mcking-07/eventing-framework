import { DomainEvent } from 'eventing-framework';
import type { OrderPlacedPayload } from './types';

class OrderEvent<PayloadType = Record<string, unknown>> extends DomainEvent {
  constructor(name: string, payload: PayloadType) {
    super(name, { ...payload, app: 'order-service', category: 'order' });
  }
}

class OrderPlaced extends OrderEvent {
  constructor(payload: OrderPlacedPayload) {
    super('OrderPlaced', payload);
  }
}

export { OrderPlaced };
