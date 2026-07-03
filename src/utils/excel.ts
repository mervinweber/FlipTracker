import * as XLSX from 'xlsx';
import { InventoryItem } from '../types/inventory';

const now = () => new Date().toISOString();

function numberValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export function exportInventory(items: InventoryItem[]) {
  const rows = items.map(i => ({
    Type: i.type,
    Console: i.console || '',
    Title: i.title,
    Edition: i.edition || '',
    'Estimated eBay Low': i.estLow || '',
    'Estimated eBay High': i.estHigh || '',
    'User Value Low': i.userLow || '',
    'User Value High': i.userHigh || '',
    'Value Source': i.valueSource || 'Estimated',
    'Needs Value Check': i.needsValueCheck ? 'Y' : '',
    'Local Low': i.localLow || '',
    'Local High': i.localHigh || '',
    Priority: i.priority || '',
    Status: i.status || 'Inventory',
    'Purchase Price': i.purchasePrice || '',
    'Sold Price': i.soldPrice || '',
    Fees: i.fees || '',
    Shipping: i.shipping || '',
    Condition: i.condition || '',
    Complete: i.complete ? 'Y' : '',
    Manual: i.manual ? 'Y' : '',
    Confidence: i.confidence || '',
    Notes: i.notes || ''
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  XLSX.writeFile(wb, 'fliptracker-inventory.xlsx');
}

export async function importInventoryFile(file: File): Promise<InventoryItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return rows.map(row => ({
    type: (row.Type as InventoryItem['type']) || 'Video Game',
    console: String(row.Console || ''),
    title: String(row.Title || row.Game || '').trim(),
    edition: String(row.Edition || ''),
    estLow: numberValue(row['Estimated eBay Low'] || row['eBay Low'] || row.estLow),
    estHigh: numberValue(row['Estimated eBay High'] || row['eBay High'] || row.estHigh),
    userLow: numberValue(row['User Value Low']),
    userHigh: numberValue(row['User Value High']),
    valueSource: (row['Value Source'] as InventoryItem['valueSource']) || 'Estimated',
    needsValueCheck: String(row['Needs Value Check'] || '').toUpperCase() === 'Y',
    localLow: numberValue(row['Local Low']),
    localHigh: numberValue(row['Local High']),
    priority: String(row.Priority || ''),
    status: String(row.Status || 'Inventory'),
    purchasePrice: numberValue(row['Purchase Price']),
    soldPrice: numberValue(row['Sold Price']),
    fees: numberValue(row.Fees),
    shipping: numberValue(row.Shipping),
    condition: String(row.Condition || ''),
    complete: String(row.Complete || '').toUpperCase() === 'Y',
    manual: String(row.Manual || '').toUpperCase() === 'Y',
    confidence: String(row.Confidence || ''),
    notes: String(row.Notes || ''),
    createdAt: now(),
    updatedAt: now()
  })).filter(i => i.title);
}
