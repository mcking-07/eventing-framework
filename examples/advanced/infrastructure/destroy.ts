const BASE = 'http://localhost:4566';
const QUEUE_URLS = [
  'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/inventory-queue',
  'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/notification-queue',
  'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/shipping-queue',
];
const TOPIC_ARNS = [
  'arn:aws:sns:us-east-1:000000000000:order-events',
  'arn:aws:sns:us-east-1:000000000000:inventory-events',
  'arn:aws:sns:us-east-1:000000000000:shipping-events',
];

async function destroy() {
  console.log('\n[infra] tearing down...');

  console.log('[infra] deleting sns topics...');
  for (const arn of TOPIC_ARNS) {
    await fetch(`${BASE}/?Action=DeleteTopic&TopicArn=${encodeURIComponent(arn)}`);
  }

  console.log('[infra] deleting sqs queues...');
  for (const url of QUEUE_URLS) {
    await fetch(`${url}?Action=DeleteQueue`);
  }

  console.log('[infra] emptying and deleting s3 bucket...');
  const list = await fetch(`${BASE}/eventing-reference-bucket?list-type=2`);
  const text = await list.text();
  const keys = [...text.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
  for (const key of keys) {
    await fetch(`${BASE}/eventing-reference-bucket/${encodeURIComponent(key!)}`, { method: 'DELETE' });
  }
  await fetch(`${BASE}/eventing-reference-bucket`, { method: 'DELETE' });

  console.log('[infra] done');
}

export { destroy };
