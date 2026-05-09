const BASE = 'http://localhost:4566';
const TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:order-events';
const QUEUE_URL = 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/notification-queue';
const QUEUE_ARN = 'arn:aws:sqs:us-east-1:000000000000:notification-queue';

async function create() {
  console.log('[infra] creating sns topic...');
  await fetch(`${BASE}/?Action=CreateTopic&Name=order-events`);

  console.log('[infra] creating sqs queue...');
  await fetch(`${BASE}/?Action=CreateQueue&QueueName=notification-queue`);

  console.log('[infra] setting queue policy...');
  const policy = encodeURIComponent(JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Principal: '*',
      Action: 'sqs:SendMessage',
      Resource: QUEUE_ARN,
      Condition: { ArnEquals: { 'aws:SourceArn': TOPIC_ARN } },
    }],
  }));
  await fetch(`${QUEUE_URL}?Action=SetQueueAttributes&Attribute.1.Name=Policy&Attribute.1.Value=${policy}`);

  console.log('[infra] creating s3 bucket...');
  await fetch(`${BASE}/eventing-reference-bucket`, { method: 'PUT' });

  console.log('[infra] subscribing queue to topic...');
  const params = new URLSearchParams({
    Action: 'Subscribe',
    TopicArn: TOPIC_ARN,
    Protocol: 'sqs',
    Endpoint: QUEUE_ARN,
    'Attributes.entry.1.key': 'RawMessageDelivery',
    'Attributes.entry.1.value': 'true',
  });
  await fetch(`${BASE}/?${params}`);

  console.log('[infra] resources created');
}

export { create };
