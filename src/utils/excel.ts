import * as XLSX from 'xlsx';
import type { InventoryItem } from '../types/inventory.ts';

const now = () => new Date().toISOString();

function numberValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function textValue(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function rowValue(row: Record<string, unknown>, names: string[]) {
  const normalized = new Map(Object.keys(row).map((key) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), key]));
  for (const name of names) {
    const key = normalized.get(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (key !== undefined) return row[key];
  }
  return undefined;
}

function hasAny(row: Record<string, unknown>, names: string[]) {
  return names.some((name) => textValue(rowValue(row, [name])));
}

function integerValue(value: unknown): number {
  const parsed = numberValue(value);
  if (!parsed || parsed < 1) return 1;
  return Math.min(999, Math.floor(parsed));
}

function normalizeCardCondition(value: string) {
  const text = value.trim();
  const lower = text.toLowerCase();
  if (!text) return '';
  if (lower === 'nm' || lower.includes('near mint')) return 'Near Mint';
  if (lower === 'lp' || lower.includes('lightly played')) return 'Lightly Played';
  if (lower === 'mp' || lower.includes('moderately played')) return 'Moderately Played';
  if (lower === 'hp' || lower.includes('heavily played')) return 'Heavily Played';
  if (lower === 'dmg' || lower.includes('damaged')) return 'Damaged';
  return text;
}

function normalizeCardGame(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes('pokemon') || lower.includes('pokémon')) return { type: 'Pokemon Card' as InventoryItem['type'], game: 'Pokemon TCG' };
  if (lower.includes('yu-gi') || lower.includes('yugioh')) return { type: 'Yu-Gi-Oh! Card' as InventoryItem['type'], game: 'Yu-Gi-Oh! TCG' };
  if (lower.includes('magic')) return { type: 'Trading Card' as InventoryItem['type'], game: 'Magic: The Gathering' };
  if (lower.includes('one piece')) return { type: 'Trading Card' as InventoryItem['type'], game: 'One Piece Card Game' };
  if (lower.includes('lorcana')) return { type: 'Trading Card' as InventoryItem['type'], game: 'Disney Lorcana' };
  if (lower.includes('sport')) return { type: 'Sports Card' as InventoryItem['type'], game: '' };
  return { type: 'Trading Card' as InventoryItem['type'], game: value || 'Other CCG' };
}

function recommendationForCard(marketPrice?: number): InventoryItem['listingRecommendation'] {
  if (marketPrice === undefined) return 'Review';
  if (marketPrice >= 5) return 'Sell Individually';
  if (marketPrice >= 1) return 'Bundle';
  return 'Skip';
}

function cardPriority(marketPrice?: number) {
  if (marketPrice === undefined) return 'Review';
  if (marketPrice >= 20) return 'List First';
  if (marketPrice >= 5) return 'Worth Listing';
  if (marketPrice >= 1) return 'Bundle Candidate';
  return 'Bulk / Skip';
}

function cardPriceBand(marketPrice?: number) {
  if (marketPrice === undefined) return {};
  const low = Math.max(0.25, Math.round(marketPrice * 0.85 * 100) / 100);
  const high = Math.round(marketPrice * 1.15 * 100) / 100;
  return { estLow: low, estHigh: high };
}

function isTcgplayerRow(row: Record<string, unknown>) {
  return hasAny(row, [
    'Product Line',
    'ProductLine',
    'TCGplayer ID',
    'TCGplayer Id',
    'TCGplayer Product ID',
    'Market Price',
    'TCG Market Price',
    'Printing',
    'Rarity',
    'Set Name',
    'Card Number',
    'Number',
  ]) && hasAny(row, ['Product Name', 'Product', 'Name', 'Title']);
}

export function inventoryItemFromTcgplayerRow(row: Record<string, unknown>): InventoryItem {
  const productLine = textValue(rowValue(row, ['Product Line', 'ProductLine', 'Game', 'Category']));
  const { type, game } = normalizeCardGame(productLine);
  const title = textValue(rowValue(row, ['Product Name', 'Product', 'Name', 'Title', 'Card Name']));
  const setName = textValue(rowValue(row, ['Set Name', 'Set', 'Expansion']));
  const cardNumber = textValue(rowValue(row, ['Number', 'Card Number', 'Collector Number', 'Collector #']));
  const rarity = textValue(rowValue(row, ['Rarity']));
  const finish = textValue(rowValue(row, ['Printing', 'Finish', 'Foil']));
  const edition = textValue(rowValue(row, ['Edition']));
  const language = textValue(rowValue(row, ['Language'])) || 'English';
  const condition = normalizeCardCondition(textValue(rowValue(row, ['Condition'])));
  const tcgId = textValue(rowValue(row, ['TCGplayer ID', 'TCGplayer Id', 'TCGplayer Product ID', 'Product ID']));
  const marketPrice = numberValue(rowValue(row, ['Market Price', 'TCG Market Price', 'TCG Market', 'Listed Median', 'Low Price', 'Price']));
  const purchasePrice = numberValue(rowValue(row, ['Purchase Price', 'Cost', 'Buy Price', 'Paid']));
  const storageLocation = textValue(rowValue(row, ['Storage Location', 'Location', 'Bin']));
  const identifier = [setName, cardNumber].filter(Boolean).join(' #') || tcgId;
  const displayTitle = [title, setName, cardNumber, rarity, finish].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const priceBand = cardPriceBand(marketPrice);
  const valueLines = [
    productLine ? `Product line: ${productLine}` : '',
    setName ? `Set: ${setName}` : '',
    cardNumber ? `Card number: ${cardNumber}` : '',
    rarity ? `Rarity: ${rarity}` : '',
    finish ? `Printing/finish: ${finish}` : '',
    edition ? `Edition: ${edition}` : '',
    condition ? `Condition: ${condition}` : '',
    marketPrice !== undefined ? `TCGplayer market price: $${marketPrice.toFixed(2)}` : '',
    tcgId ? `TCGplayer product ID: ${tcgId}` : '',
  ].filter(Boolean);
  return {
    type,
    title,
    mediaFormat: 'Trading Card',
    barcode: identifier,
    barcodeType: 'Card identifier',
    cardProductType: 'Single Card',
    cardGame: type === 'Sports Card' ? undefined : game,
    cardSet: setName,
    cardNumber,
    cardProvider: 'TCGplayer CSV',
    cardProviderId: tcgId,
    cardLanguage: language,
    cardRarity: rarity,
    cardFinish: finish,
    cardEdition: edition,
    cardIdentificationMethod: 'TCGplayer CSV import',
    cardIdentificationConfidence: 0.95,
    metadataSource: 'TCGplayer CSV',
    metadataConfidence: 'High',
    metadataCheckedAt: Date.now(),
    acquiredDate: textValue(rowValue(row, ['Acquired Date', 'Purchase Date'])) || '',
    storageLocation,
    ...priceBand,
    valueSource: marketPrice !== undefined ? 'TCGplayer Market' : 'Estimated',
    needsValueCheck: marketPrice === undefined,
    priority: cardPriority(marketPrice),
    strategy: recommendationForCard(marketPrice),
    listingRecommendation: recommendationForCard(marketPrice),
    status: 'Inventory',
    purchasePrice,
    condition,
    completeness: 'Single Card',
    complete: true,
    manual: false,
    ebayTitle: displayTitle.slice(0, 80),
    ebayDescription: [
      `${game || productLine || 'Trading card'} single card: ${title}`,
      ...valueLines,
      'Photos should show the exact front and back of the card before listing.',
    ].filter(Boolean).join('\n'),
    ebayCondition: condition,
    ebayItemSpecifics: valueLines.join('\n'),
    ebayPrice: marketPrice,
    notes: [
      'Imported from TCGplayer CSV.',
      marketPrice !== undefined ? 'TCGplayer market price applied as the starting listing price.' : 'No TCGplayer market price was present; review before listing.',
    ].join(' '),
    confidence: 'High',
    createdAt: now(),
    updatedAt: now(),
  };
}

export function importInventoryRows(rows: Record<string, unknown>[]): InventoryItem[] {
  return rows.flatMap(row => {
    if (isTcgplayerRow(row)) {
      const quantity = integerValue(rowValue(row, ['Quantity', 'Qty', 'Count']));
      const item = inventoryItemFromTcgplayerRow(row);
      return Array.from({ length: quantity }, () => ({ ...item, createdAt: now(), updatedAt: now() }));
    }
    return [{
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
      cardProductType: String(row['Card Product Type'] || row['Sale Format'] || ''),
      cardGame: String(row['Card Game'] || ''),
      cardSport: String(row.Sport || row['Card Sport'] || ''),
      cardSet: String(row.Set || row['Card Set'] || ''),
      cardNumber: String(row.Number || row['Card Number'] || row['Collector Number'] || ''),
      cardProvider: String(row['Card Provider'] || ''),
      cardProviderId: String(row['Card Provider ID'] || row['TCGplayer ID'] || ''),
      cardLanguage: String(row.Language || row['Card Language'] || ''),
      cardRarity: String(row.Rarity || ''),
      cardFinish: String(row.Finish || row.Printing || ''),
      cardEdition: String(row.Edition || row['Card Edition'] || ''),
      coverImageUrl: String(row['Cover Image URL'] || ''),
      metadataSource: String(row['Metadata Source'] || ''),
      metadataConfidence: String(row['Metadata Confidence'] || ''),
      collectionName: String(row.Collection || row['Collection Name'] || ''),
      acquiredDate: String(row['Acquired Date'] || row['Purchase Date'] || ''),
      listedDate: String(row['Listed Date'] || ''),
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
      aiDescription: String(row['AI Description'] || ''),
      itemDisclosures: String(row['Item Disclosures'] || row.Disclosures || ''),
      confidence: String(row.Confidence || ''),
      ebayTitle: String(row['eBay Title'] || ''),
      ebayDescription: String(row['eBay Description'] || ''),
      ebayCategory: String(row['eBay Category'] || ''),
      ebayCategoryId: String(row['eBay Category ID'] || row['Category ID'] || ''),
      ebayCondition: String(row['eBay Condition'] || ''),
      ebayItemSpecifics: String(row['eBay Item Specifics'] || ''),
      ebayPrice: numberValue(row['eBay Price']),
      ebayShipping: String(row['eBay Shipping'] || ''),
      notes: String(row.Notes || ''),
      createdAt: now(),
      updatedAt: now()
    }];
  }).filter(i => i.title);
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
    'Acquired Date': i.acquiredDate || '',
    'Listed Date': i.listedDate || '',
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
    'AI Description': i.aiDescription || '',
    'Item Disclosures': i.itemDisclosures || '',
    Confidence: i.confidence || '',
    'eBay Title': i.ebayTitle || '',
    'eBay Description': i.ebayDescription || '',
    'eBay Category': i.ebayCategory || '',
    'eBay Category ID': i.ebayCategoryId || '',
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
  return importInventoryRows(rows);
}
