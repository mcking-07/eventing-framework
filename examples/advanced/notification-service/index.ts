import { Application } from 'eventing-framework';
import type { OrderPlacedPayload, OrderShippedPayload } from '../common';
import { delay } from '../common';

const config = {
  queueUrl: 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/notification-queue',
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
};

type AppEvents = {
  OrderPlaced: OrderPlacedPayload;
  OrderShipped: OrderShippedPayload;
};

export async function run() {
  const app = new Application<AppEvents>({
    name: 'notification-service',
    environment: 'development',
    queue: {
      url: config.queueUrl,
      config: { region: config.region, endpoint: config.endpoint },
      params: { MaxNumberOfMessages: 10, WaitTimeSeconds: 5, MessageAttributeNames: ['All'] },
    },
    storage: {
      bucket: 'eventing-reference-bucket',
      config: { region: config.region, endpoint: config.endpoint, forcePathStyle: true },
    },
    scheduler: { interval: 1_000 },
  });

  app.on('OrderPlaced', async (payload) => {
    console.log(`[notification-service] order placed: ${payload.orderId} (${payload.items.length} items) for $${payload.total}`);
  });

  app.on('OrderShipped', async (payload) => {
    console.log(`[notification-service] order shipped: ${payload.orderId}`);
  });

  await app.start();
  await delay(8_000);
  await app.stop();
}
