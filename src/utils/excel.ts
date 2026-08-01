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
    Format: i.mediaFormat || '',
    UPC: i.upc || i.barcode || '',
    'Barcode Type': i.barcodeType || '',
    'Release Year': i.releaseYear || '',
    'Release Date': i.releaseDate || '',
    Studio: i.studio || '',
    Author: i.author || '',
    Rating: i.rating || '',
    'Cover Image URL': i.coverImageUrl || '',
    'Metadata Source': i.metadataSource || '',
    'Metadata Confidence': i.metadataConfidence || '',
    Collection: i.collectionName || '',
    'Storage Location': i.storageLocation || '',
    'Estimated eBay Low': i.estLow || '',
    'Estimated eBay High': i.estHigh || '',
    'User Value Low': i.userLow || '',
    'User Value High': i.userHigh || '',
    'Value Source': i.valueSource || 'Estimated',
    'Needs Value Check': i.needsValueCheck ? 'Y' : '',
    'Local Low': i.localLow || '',
    'Local High': i.localHigh || '',
    Priority: i.priority || '',
    Strategy: i.strategy || '',
    Recommendation: i.listingRecommendation || '',
    Status: i.status || 'Inventory',
    'Purchase Price': i.purchasePrice || '',
    'Sold Price': i.soldPrice || '',
    Fees: i.fees || '',
    Shipping: i.shipping || '',
    Condition: i.condition || '',
    Completeness: i.completeness || '',
    Complete: i.complete ? 'Y' : '',
    Manual: i.manual ? 'Y' : '',
    Confidence: i.confidence || '',
    'eBay Title': i.ebayTitle || '',
    'eBay Description': i.ebayDescription || '',
    'eBay Category': i.ebayCategory || '',
    'eBay Condition': i.ebayCondition || '',
    'eBay Item Specifics': i.ebayItemSpecifics || '',
    'eBay Price': i.ebayPrice || '',
    'eBay Shipping': i.ebayShipping || '',
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
    mediaFormat: String(row.Format || row['Media Format'] || ''),
    upc: String(row.UPC || row.Barcode || ''),
    barcode: String(row.Barcode || row.UPC || ''),
    barcodeType: String(row['Barcode Type'] || ''),
    releaseYear: String(row['Release Year'] || ''),
    releaseDate: String(row['Release Date'] || ''),
    studio: String(row.Studio || row.Publisher || ''),
    author: String(row.Author || row.Creator || ''),
    rating: String(row.Rating || ''),
    coverImageUrl: String(row['Cover Image URL'] || ''),
    metadataSource: String(row['Metadata Source'] || ''),
    metadataConfidence: String(row['Metadata Confidence'] || ''),
    collectionName: String(row.Collection || row['Collection Name'] || ''),
    storageLocation: String(row['Storage Location'] || row.Bin || row.Location || ''),
    estLow: numberValue(row['Estimated eBay Low'] || row['eBay Low'] || row.estLow),
    estHigh: numberValue(row['Estimated eBay High'] || row['eBay High'] || row.estHigh),
    userLow: numberValue(row['User Value Low']),
    userHigh: numberValue(row['User Value High']),
    valueSource: (row['Value Source'] as InventoryItem['valueSource']) || 'Estimated',
    needsValueCheck: String(row['Needs Value Check'] || '').toUpperCase() === 'Y',
    localLow: numberValue(row['Local Low']),
    localHigh: numberValue(row['Local High']),
    priority: String(row.Priority || ''),
    strategy: String(row.Strategy || ''),
    listingRecommendation: (row.Recommendation as InventoryItem['listingRecommendation']) || undefined,
    status: String(row.Status || 'Inventory'),
    purchasePrice: numberValue(row['Purchase Price']),
    soldPrice: numberValue(row['Sold Price']),
    fees: numberValue(row.Fees),
    shipping: numberValue(row.Shipping),
    condition: String(row.Condition || ''),
    completeness: String(row.Completeness || ''),
    complete: String(row.Complete || '').toUpperCase() === 'Y',
    manual: String(row.Manual || '').toUpperCase() === 'Y',
    confidence: String(row.Confidence || ''),
    ebayTitle: String(row['eBay Title'] || ''),
    ebayDescription: String(row['eBay Description'] || ''),
    ebayCategory: String(row['eBay Category'] || ''),
    ebayCondition: String(row['eBay Condition'] || ''),
    ebayItemSpecifics: String(row['eBay Item Specifics'] || ''),
    ebayPrice: numberValue(row['eBay Price']),
    ebayShipping: String(row['eBay Shipping'] || ''),
    notes: String(row.Notes || ''),
    createdAt: now(),
    updatedAt: now()
  })).filter(i => i.title);
}
