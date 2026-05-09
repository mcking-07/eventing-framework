const BASE = 'http://localhost:4566';
const ORDER_ARN = 'arn:aws:sns:us-east-1:000000000000:order-events';
const INVENTORY_ARN = 'arn:aws:sns:us-east-1:000000000000:inventory-events';
const SHIPPING_ARN = 'arn:aws:sns:us-east-1:000000000000:shipping-events';
const INVENTORY_URL = 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/inventory-queue';
const NOTIFICATION_URL = 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/notification-queue';
const SHIPPING_URL = 'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/shipping-queue';
const INVENTORY_QARN = 'arn:aws:sqs:us-east-1:000000000000:inventory-queue';
const NOTIFICATION_QARN = 'arn:aws:sqs:us-east-1:000000000000:notification-queue';
const SHIPPING_QARN = 'arn:aws:sqs:us-east-1:000000000000:shipping-queue';

function sp(params: Record<string, string>) {
  return new URLSearchParams(params);
}

async function create() {
  console.log('[infra] creating sns topics...');
  await fetch(`${BASE}/?Action=CreateTopic&Name=order-events`);
  await fetch(`${BASE}/?Action=CreateTopic&Name=inventory-events`);
  await fetch(`${BASE}/?Action=CreateTopic&Name=shipping-events`);

  console.log('[infra] creating sqs queues...');
  await fetch(`${BASE}/?Action=CreateQueue&QueueName=inventory-queue`);
  await fetch(`${BASE}/?Action=CreateQueue&QueueName=notification-queue`);
  await fetch(`${BASE}/?Action=CreateQueue&QueueName=shipping-queue`);

  console.log('[infra] purging queues...');
  await fetch(`${INVENTORY_URL}?Action=PurgeQueue`);
  await fetch(`${NOTIFICATION_URL}?Action=PurgeQueue`);
  await fetch(`${SHIPPING_URL}?Action=PurgeQueue`);

  console.log('[infra] setting queue policies...');
  const policy = (arn: string, sources: string[]) => encodeURIComponent(JSON.stringify({
    Version: '2012-10-17',
    Statement: sources.map((s) => ({ Effect: 'Allow', Principal: '*', Action: 'sqs:SendMessage', Resource: arn, Condition: { ArnEquals: { 'aws:SourceArn': s } } })),
  }));
  await fetch(`${INVENTORY_URL}?Action=SetQueueAttributes&Attribute.1.Name=Policy&Attribute.1.Value=${policy(INVENTORY_QARN, [ORDER_ARN])}&Attribute.2.Name=VisibilityTimeout&Attribute.2.Value=3`);
  await fetch(`${NOTIFICATION_URL}?Action=SetQueueAttributes&Attribute.1.Name=Policy&Attribute.1.Value=${policy(NOTIFICATION_QARN, [ORDER_ARN, INVENTORY_ARN, SHIPPING_ARN])}`);
  await fetch(`${SHIPPING_URL}?Action=SetQueueAttributes&Attribute.1.Name=Policy&Attribute.1.Value=${policy(SHIPPING_QARN, [INVENTORY_ARN])}`);

  console.log('[infra] creating s3 bucket...');
  await fetch(`${BASE}/eventing-reference-bucket`, { method: 'PUT' });

  console.log('[infra] subscribing queues to topics...');
  await fetch(`${BASE}/?${sp({ Action: 'Subscribe', TopicArn: ORDER_ARN, Protocol: 'sqs', Endpoint: INVENTORY_QARN, 'Attributes.entry.1.key': 'RawMessageDelivery', 'Attributes.entry.1.value': 'true' })}`);
  await fetch(`${BASE}/?${sp({ Action: 'Subscribe', TopicArn: ORDER_ARN, Protocol: 'sqs', Endpoint: NOTIFICATION_QARN, 'Attributes.entry.1.key': 'RawMessageDelivery', 'Attributes.entry.1.value': 'true' })}`);
  await fetch(`${BASE}/?${sp({ Action: 'Subscribe', TopicArn: INVENTORY_ARN, Protocol: 'sqs', Endpoint: NOTIFICATION_QARN, 'Attributes.entry.1.key': 'RawMessageDelivery', 'Attributes.entry.1.value': 'true' })}`);
  await fetch(`${BASE}/?${sp({ Action: 'Subscribe', TopicArn: INVENTORY_ARN, Protocol: 'sqs', Endpoint: SHIPPING_QARN, 'Attributes.entry.1.key': 'RawMessageDelivery', 'Attributes.entry.1.value': 'true' })}`);
  await fetch(`${BASE}/?${sp({ Action: 'Subscribe', TopicArn: SHIPPING_ARN, Protocol: 'sqs', Endpoint: NOTIFICATION_QARN, 'Attributes.entry.1.key': 'RawMessageDelivery', 'Attributes.entry.1.value': 'true' })}`);

  console.log('[infra] resources created');
  return {};
}

export { create };
