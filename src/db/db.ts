import Dexie, { Table } from 'dexie';
import { InventoryItem } from '../types/inventory';

export class FlipTrackerDb extends Dexie {
  inventory!: Table<InventoryItem, number>;

  constructor() {
    super('fliptracker');
    this.version(1).stores({ inventory: '++id, type, console, title, status, priority, confidence, createdAt' });
  }
}

export const db = new FlipTrackerDb();
