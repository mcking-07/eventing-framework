# eventing-framework

an opinionated event-driven framework for building asynchronous systems on amazon web services.

eventing-framework connects services through a typed event bus built on sns topics, sqs queues, and s3 storage. define domain events, run handlers when they arrive, and emit new events from anywhere in your code. the framework handles publishing, polling, oversized payloads, and s3 reference resolution behind the scenes.

- typed domain events with per-service base classes
- transparent oversized payload routing (inline or s3 reference)
- error isolation — a failing handler doesn't block the rest of the batch
- zero dependencies beyond the aws sdk

eventing-framework lets your services communicate without coupling. publish what happened. subscribe to what matters.

## installation

```sh
npm install eventing-framework
```

requires node.js 20 or later.

## usage

### defining events

extend `DomainEvent` to define your events. use an intermediate base class to inject per-service metadata once.

```typescript
import { DomainEvent } from 'eventing-framework';

class OrderEvent<PayloadType = Record<string, unknown>> extends DomainEvent {
  constructor(name: string, payload: PayloadType) {
    super(name, { ...payload, app: 'order-service', category: 'order' });
  }
}

class OrderPlaced extends OrderEvent<{ orderId: string; total: number }> {
  constructor(payload: { orderId: string; total: number }) {
    super('OrderPlaced', payload);
  }
}

class OrderProcessed extends OrderEvent<{ orderId: string }> {
  constructor(payload: { orderId: string }) {
    super('OrderProcessed', payload);
  }
}
```

### configuring

configure only what your service needs — topic and queue for the publishing side, queue and storage for the consuming side.

```typescript
import { Application } from 'eventing-framework';

const app = new Application({
  name: 'order-service',
  environment: 'development',
  topic: {
    arn: 'arn:aws:sns:us-east-1:123456789012:order-events',
    config: { region: 'us-east-1' },
  },
  queue: {
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/notification-queue',
    config: { region: 'us-east-1' },
    params: { MessageAttributeNames: ['All'], WaitTimeSeconds: 5 },
  },
  storage: {
    bucket: 'eventing-reference-bucket',
    config: { region: 'us-east-1' },
  },
  scheduler: { interval: 5_000 },
});
```

### consuming events

services consume events published by other services. the framework polls sqs, resolves the payload, and routes it to your handler.

use a typed event map for auto-typed payloads.

```typescript
type AppEvents = {
  OrderPlaced: { orderId: string; total: number };
  OrderProcessed: { orderId: string };
};

const app = new Application<AppEvents>({ ... });
app.on('OrderPlaced', async (payload) => {
  console.log(`order ${payload.orderId} for $${payload.total}`);
});
```

or use an explicit generic on a bare `Application()`.

```typescript
const app = new Application({ ... });
app.on<{ orderId: string; total: number }>('OrderPlaced', async (payload) => {
  console.log(`order ${payload.orderId} for $${payload.total}`);
});
```

### publishing events

register the event, then emit from anywhere in your process.

```typescript
import { EventPublisher } from 'eventing-framework';

app.register('OrderProcessed');
EventPublisher.emit(new OrderProcessed({ orderId: '123' }));
```

### chaining events

a handler can emit the next event in the flow — the chain continues to downstream services without coordination.

```typescript
app.on('OrderPlaced', async (payload) => {
  await processOrder(payload);
  EventPublisher.emit(new OrderProcessed({ orderId: payload.orderId }));
});
```

### starting and stopping

```typescript
await app.start();  // begins polling on the configured interval
await app.stop();   // stops the scheduler, clears handlers and registrations
```

## examples

two working examples against localstack — no aws account needed.

- **[single event](examples/simple/README.md)** — a publisher and a consumer communicating through a single event type
- **[multi-step workflow](examples/advanced/README.md)** — four services chained across three event types, with oversized payloads and error handling

## design decisions

### why sns + sqs + s3

sns handles fan-out to multiple queues. sqs provides at-least-once delivery with visibility timeouts for retry. s3 stores payloads that exceed sns's 256kb message size limit — the framework routes oversized payloads transparently, consumers resolve references without knowing the difference.

### why EventPublisher is static

events come from handlers, webhooks, scheduled jobs — anywhere. a static emitter avoids threading an `Application` reference through every layer of your code. `EventPublisher.emit()` fires locally, `register()` catches it and publishes to sns.

### why register() and on() are separate

`register()` controls what leaves the service. `on()` controls what enters. the boundary is explicit — consume without publishing, publish without consuming, or both.

errors in handlers are isolated — one failing handler doesn't block the rest of the batch. the failed message stays in sqs for retry.

## api reference

### Application

```typescript
class Application<Events extends Record<string, unknown>> {
  constructor(config: ApplicationConfig)
  register(event: string): void
  on<PayloadType>(event: string, handler: (payload: PayloadType) => void | Promise<void>): void
  on<Event extends keyof Events>(event: Event, handler: (payload: Events[Event]) => void | Promise<void>): void
  start(): Promise<void>
  stop(): Promise<void>
}
```

### ApplicationConfig

```typescript
type ApplicationConfig = {
  name: string
  environment: 'development' | 'staging' | 'production'

  topic?: {
    arn: string
    config: SNSClientConfig
    params?: Omit<PublishCommandInput, 'TopicArn' | 'Message'>
  }

  queue?: {
    url: string
    config: SQSClientConfig
    params?: Omit<ReceiveMessageCommandInput, 'QueueUrl'>
  }

  storage?: {
    bucket: string
    config: S3ClientConfig
  }

  scheduler?: {
    interval: number
  }
}
```

all service configs are optional — configure only what your service needs.

### DomainEvent

```typescript
class DomainEvent<PayloadType> {
  readonly id: string        // uuid v7
  readonly name: string      // event name
  readonly payload: PayloadType
  readonly timestamp: number // epoch ms
}
```

extend `DomainEvent` to define your events. use an intermediate base class to inject per-service metadata (`app`, `category`) once.

### EventPublisher

```typescript
class EventPublisher {
  static emit<EventType extends DomainEvent>(event: EventType): void
}
```

emits a domain event to local listeners registered via `Application.register()`. can be called from anywhere in your process.
