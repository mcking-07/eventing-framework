type OrderItem = {
  sku: string;
  name: string;
  qty: number;
  price: string;
};

type OrderPlacedPayload = {
  orderId: string;
  customerEmail: string;
  total: number;
  items: OrderItem[];
};

type InventoryReservedPayload = {
  orderId: string;
};

type OrderShippedPayload = {
  orderId: string;
};

export type { InventoryReservedPayload, OrderItem, OrderPlacedPayload, OrderShippedPayload };
