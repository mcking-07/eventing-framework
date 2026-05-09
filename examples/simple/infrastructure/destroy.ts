const BASE = 'http://localhost:4566';
const TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:order-events';
const QUEUE_URL = 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/notification-queue';

async function destroy() {
  console.log('\n[infra] tearing down...');

  console.log('[infra] deleting sns topic...');
  await fetch(`${BASE}/?Action=DeleteTopic&TopicArn=${encodeURIComponent(TOPIC_ARN)}`);

  console.log('[infra] deleting sqs queue...');
  await fetch(`${QUEUE_URL}?Action=DeleteQueue`);

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
