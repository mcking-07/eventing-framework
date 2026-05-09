import { check, create, destroy } from './infrastructure';
import { run as orders } from './order-service';
import { run as notifications } from './notification-service';

await check();
await create();

console.log('\n[demo] running order-service...');
await orders();

console.log('\n[demo] running notification-service...');
await notifications();

console.log('\n[demo] complete');

await destroy();
