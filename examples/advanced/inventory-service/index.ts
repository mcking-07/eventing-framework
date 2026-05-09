import { Application, EventPublisher } from 'eventing-framework';
import { InventoryReserved, delay } from '../common';
import type { OrderPlacedPayload } from '../common';

const config = {
  queueUrl: 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/inventory-queue',
  topicArn: 'arn:aws:sns:us-east-1:000000000000:inventory-events',
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
};

type AppEvents = {
  OrderPlaced: OrderPlacedPayload;
};

export async function run() {
  const app = new Application<AppEvents>({
    name: 'inventory-service',
    environment: 'development',
    queue: {
      url: config.queueUrl,
      config: { region: config.region, endpoint: config.endpoint },
      params: { MaxNumberOfMessages: 10, WaitTimeSeconds: 5, MessageAttributeNames: ['All'] },
    },
    topic: {
      arn: config.topicArn,
      config: { region: config.region, endpoint: config.endpoint },
    },
    storage: {
      bucket: 'eventing-reference-bucket',
      config: { region: config.region, endpoint: config.endpoint, forcePathStyle: true },
    },
    scheduler: { interval: 1_000 },
  });

  app.register('InventoryReserved');

  const failed = new Set<string>();

  app.on('OrderPlaced', async (payload) => {
    if (payload.items.length > 100 && !failed.has(payload.orderId)) {
      failed.add(payload.orderId);
      console.log('[inventory-service] handler failed — message will retry');
      throw new Error('simulated inventory failure');
    }

    console.log(`[inventory-service] reserving inventory for ${payload.orderId}`);
    EventPublisher.emit(new InventoryReserved({ orderId: payload.orderId }));
  });

  await app.start();
  await delay(8_000);
  await app.stop();
}
