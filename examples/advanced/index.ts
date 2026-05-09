import { check, create, destroy } from './infrastructure';
import { run as orders } from './order-service';
import { run as inventory } from './inventory-service';
import { run as notifications } from './notification-service';
import { run as ship } from './ship-service';

await check();
await create();

console.log('\n[demo] running order-service...');
await orders();

console.log('\n[demo] running inventory-service...');
await inventory();

console.log('\n[demo] running ship-service...');
await ship();

console.log('\n[demo] running notification-service...');
await notifications();

console.log('\n[demo] complete');

await destroy();
