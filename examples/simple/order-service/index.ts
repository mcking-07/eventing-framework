import { Application, EventPublisher, type ApplicationConfig } from 'eventing-framework';
import { OrderPlaced } from '../common';
import { delay } from '../common';

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

export async function run() {
  const app = new Application({ ...config });

  app.register('OrderPlaced');

  const payload = { orderId: 'ord_001', customerEmail: 'customer@example.com', total: 49.99 };
  EventPublisher.emit(new OrderPlaced(payload));

  console.log('[order-service] emitted OrderPlaced event for ord_001');
  await delay(2_000);
}
