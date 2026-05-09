import { Application, EventPublisher, type ApplicationConfig } from 'eventing-framework';
import { OrderPlaced, delay } from '../common';

const config = {
  name: 'order-service',
  environment: 'development',
  topic: {
    arn: 'arn:aws:sns:us-east-1:000000000000:order-events',
    config: { region: 'us-east-1', endpoint: 'http://localhost:4566' },
  },
  storage: {
    bucket: 'eventing-reference-bucket',
    config: { region: 'us-east-1', endpoint: 'http://localhost:4566', forcePathStyle: true },
  },
} satisfies ApplicationConfig;

function items(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    sku: `SKU-${String(i).padStart(5, '0')}`,
    name: `product item number ${i}`,
    qty: (i % 10) + 1,
    price: (Math.random() * 100).toFixed(2),
  }));
}

export async function run() {
  const app = new Application(config);

  app.register('OrderPlaced');

  console.log('[order-service] emitting inline order...');
  EventPublisher.emit(new OrderPlaced({ orderId: 'ord-inline', customerEmail: 'inline@example.com', total: 49.99, items: items(2) }));

  console.log('[order-service] emitting oversized order (payload >256KB)...');
  EventPublisher.emit(new OrderPlaced({ orderId: 'ord-large', customerEmail: 'bulk@example.com', total: 9999.99, items: items(3000) }));

  await delay(3_000);
}
