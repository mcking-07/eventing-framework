import { Application } from 'eventing-framework';
import type { OrderPlacedPayload } from '../common';
import { delay } from '../common';

type AppEvents = {
  OrderPlaced: OrderPlacedPayload;
};

export async function run() {
  const app = new Application<AppEvents>({
    name: 'notification-service',
    environment: 'development',
    queue: {
      url: 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/notification-queue',
      config: { region: 'us-east-1', endpoint: 'http://localhost:4566' },
      params: { MaxNumberOfMessages: 10, WaitTimeSeconds: 5, MessageAttributeNames: ['All'] },
    },
    storage: {
      bucket: 'eventing-reference-bucket',
      config: { region: 'us-east-1', endpoint: 'http://localhost:4566', forcePathStyle: true },
    },
    scheduler: { interval: 1_000 },
  });

  app.on('OrderPlaced', async (payload) => {
    console.log(`[notification-service] sending confirmation email to ${payload.customerEmail}`);
    console.log(`[notification-service] order ${payload.orderId} confirmed for $${payload.total}`);
  });

  await app.start();
  await delay(3_000);
  await app.stop();
}
