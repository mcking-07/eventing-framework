import { Application, EventPublisher, type ApplicationConfig } from 'eventing-framework';
import { OrderShipped, delay } from '../common';
import type { InventoryReservedPayload } from '../common';

const config = {
  name: 'ship-service',
  environment: 'development',
  queue: {
    url: 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/shipping-queue',
    config: { region: 'us-east-1', endpoint: 'http://localhost:4566' },
    params: { MaxNumberOfMessages: 10, WaitTimeSeconds: 5, MessageAttributeNames: ['All'] },
  },
  topic: {
    arn: 'arn:aws:sns:us-east-1:000000000000:shipping-events',
    config: { region: 'us-east-1', endpoint: 'http://localhost:4566' },
  },
  storage: {
    bucket: 'eventing-reference-bucket',
    config: { region: 'us-east-1', endpoint: 'http://localhost:4566', forcePathStyle: true },
  },
  scheduler: { interval: 1_000 },
} satisfies ApplicationConfig;

type AppEvents = {
  InventoryReserved: InventoryReservedPayload;
};

export async function run() {
  const app = new Application<AppEvents>(config);

  app.register('OrderShipped');

  app.on('InventoryReserved', async (payload) => {
    console.log(`[ship-service] shipping order ${payload.orderId}`);
    EventPublisher.emit(new OrderShipped({ orderId: payload.orderId }));
  });

  await app.start();
  await delay(5_000);
  await app.stop();
}
