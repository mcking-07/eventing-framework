import { DomainEvent } from 'eventing-framework';
import type { InventoryReservedPayload, OrderPlacedPayload, OrderShippedPayload } from './types';

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

class InventoryEvent<PayloadType = Record<string, unknown>> extends DomainEvent {
  constructor(name: string, payload: PayloadType) {
    super(name, { ...payload, app: 'inventory-service', category: 'inventory' });
  }
}

class InventoryReserved extends InventoryEvent {
  constructor(payload: InventoryReservedPayload) {
    super('InventoryReserved', payload);
  }
}

class ShipEvent<PayloadType = Record<string, unknown>> extends DomainEvent {
  constructor(name: string, payload: PayloadType) {
    super(name, { ...payload, app: 'ship-service', category: 'ship' });
  }
}

class OrderShipped extends ShipEvent {
  constructor(payload: OrderShippedPayload) {
    super('OrderShipped', payload);
  }
}

export { InventoryReserved, OrderPlaced, OrderShipped };
