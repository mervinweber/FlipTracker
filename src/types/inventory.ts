export type ItemType = 'Video Game' | 'Pokemon Card' | 'Sports Card' | 'DVD' | 'Blu-ray' | 'Toy' | 'Misc';

export type InventoryItem = {
  id?: number;
  type: ItemType;
  console?: string;
  title: string;
  edition?: string;
  estLow?: number;
  estHigh?: number;
  localLow?: number;
  localHigh?: number;
  userLow?: number;
  userHigh?: number;
  valueSource?: 'Estimated' | 'User Override';
  needsValueCheck?: boolean;
  priority?: string;
  status?: string;
  purchasePrice?: number;
  soldPrice?: number;
  fees?: number;
  shipping?: number;
  condition?: string;
  complete?: boolean;
  manual?: boolean;
  listed?: boolean;
  sold?: boolean;
  notes?: string;
  confidence?: string;
  createdAt: string;
  updatedAt: string;
};

export function effectiveLow(item: InventoryItem): number {
  return item.valueSource === 'User Override' ? (item.userLow || 0) : (item.estLow || 0);
}

export function effectiveHigh(item: InventoryItem): number {
  return item.valueSource === 'User Override' ? (item.userHigh || 0) : (item.estHigh || 0);
}

export function effectiveAverage(item: InventoryItem): number {
  return (effectiveLow(item) + effectiveHigh(item)) / 2;
}

export function profit(item: InventoryItem): number {
  return (item.soldPrice || 0) - (item.purchasePrice || 0) - (item.fees || 0) - (item.shipping || 0);
}
