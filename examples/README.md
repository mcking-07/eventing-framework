# eventing examples

two working examples of the eventing framework, each a single command against localstack with no aws account needed.

## [single event](simple/)

a publisher and a consumer communicating through a single event type.

order-service publishes `OrderPlaced`. the framework routes it through sns → sqs, notification-service picks it up and sends a confirmation. covers shared contract types, per-service event classes, and both `on()` patterns.

```bash
cd examples/simple && npm install && npm run demo
```

## [multi-step workflow](advanced/)

four services chained across three event types, with oversized payloads and error handling.

order-service publishes two `OrderPlaced` events — one inline (2 items), one oversized (3000 items → s3 reference). inventory-service processes both, deliberately fails for the oversized one (retries after visibility timeout), then emits `InventoryReserved`. ship-service reacts to `InventoryReserved` and emits `OrderShipped`. notification-service subscribes to both `order-events` and `shipping-events`, handling two event types from a single instance.

shows event chaining, transparent oversized payload routing, handler failure isolation with automatic retry, and multi-consumer fan-out — all through the same api as simple.

```bash
cd examples/advanced && npm install && npm run demo
```
