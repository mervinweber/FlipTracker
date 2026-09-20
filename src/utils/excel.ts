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

function normalizeItemType(value: string): InventoryItem['type'] {
  const lower = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (lower === 'book' || lower === 'books') return 'Book';
  if (lower === 'dvd' || lower === 'dvds') return 'DVD';
  if (lower === 'bluray' || lower === 'blurays' || lower === 'blu') return 'Blu-ray';
  if (lower === 'cd' || lower === 'cds' || lower === 'music') return 'CD';
  if (lower === 'videogame' || lower === 'game' || lower === 'games') return 'Video Game';
  if (lower === 'pokemon' || lower === 'pokemoncard') return 'Pokemon Card';
  if (lower === 'yugioh' || lower === 'yugiohcard') return 'Yu-Gi-Oh! Card';
  if (lower === 'sportscard' || lower === 'sports') return 'Sports Card';
  if (lower === 'tradingcard' || lower === 'tcg') return 'Trading Card';
  if (lower === 'toy' || lower === 'toys') return 'Toy';
  if (lower === 'clothing' || lower === 'generalmerchandise') return 'General Merchandise';
  if (value.trim()) return value.trim() as InventoryItem['type'];
  return 'Video Game';
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

function recommendationFromPriority(priority: string): InventoryItem['listingRecommendation'] | undefined {
  const lower = priority.toLowerCase();
  if (lower.includes('skip') || lower.includes('pass')) return 'Skip';
  if (lower.includes('bundle') || lower.includes('lot')) return 'Bundle';
  if (lower.includes('review') || lower.includes('check') || lower.includes('maybe')) return 'Review';
  if (lower.includes('worth') || lower.includes('first') || lower.includes('list') || lower.includes('sell')) return 'Sell Individually';
  return undefined;
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
    const type = normalizeItemType(textValue(rowValue(row, ['Type', 'type', 'Item Type', 'Media Type'])));
    const title = textValue(rowValue(row, ['Title', 'title', 'Game', 'Name', 'Product Name', 'Item Name']));
    const mediaFormat = textValue(rowValue(row, ['Format', 'format', 'Media Format', 'Binding']));
    const upc = textValue(rowValue(row, ['UPC', 'upc', 'ISBN', 'isbn', 'Barcode', 'barcode']));
    const releaseYear = textValue(rowValue(row, ['Release Year', 'releaseYear', 'Year', 'year']));
    const author = textValue(rowValue(row, ['Author', 'author', 'Creator', 'Artist']));
    const estimatedLow = numberValue(rowValue(row, ['Estimated eBay Low', 'eBay Low', 'estLow', 'estimatedLow', 'Estimated Low', 'Low Estimate']));
    const estimatedHigh = numberValue(rowValue(row, ['Estimated eBay High', 'eBay High', 'estHigh', 'estimatedHigh', 'Estimated High', 'High Estimate']));
    const suggestedPrice = numberValue(rowValue(row, ['Suggested Price', 'suggestedPrice', 'eBay Price', 'Listing Price', 'List Price', 'Price']));
    const priority = textValue(rowValue(row, ['Priority', 'priority']));
    const explicitRecommendation = textValue(rowValue(row, ['Recommendation', 'recommendation']));
    const listingRecommendation = (explicitRecommendation as InventoryItem['listingRecommendation']) || recommendationFromPriority(priority);
    const explicitNeedsValueCheck = textValue(rowValue(row, ['Needs Value Check', 'needsValueCheck', 'Needs Review', 'Review']));
    const hasImportedValue = estimatedLow !== undefined || estimatedHigh !== undefined || suggestedPrice !== undefined;
    const notes = textValue(rowValue(row, ['Notes', 'notes', 'Comments', 'Comment']));
    const itemDisclosures = textValue(rowValue(row, ['Item Disclosures', 'Disclosures', 'Description Notes', 'Condition Notes', 'description']));
    const ebayTitle = textValue(rowValue(row, ['eBay Title', 'ebayTitle', 'Listing Title']));
    const ebayDescription = textValue(rowValue(row, ['eBay Description', 'ebayDescription', 'Listing Description', 'Description'])) || [
      title,
      author ? `Author: ${author}` : '',
      mediaFormat ? `Format: ${mediaFormat}` : '',
      releaseYear ? `Year: ${releaseYear}` : '',
      notes,
    ].filter(Boolean).join('\n');
    return [{
      type,
      console: textValue(rowValue(row, ['Console', 'console', 'Platform', 'platform'])),
      title,
      edition: textValue(rowValue(row, ['Edition', 'edition'])),
      mediaFormat,
      upc,
      barcode: upc,
      barcodeType: textValue(rowValue(row, ['Barcode Type', 'barcodeType'])),
      releaseYear,
      releaseDate: textValue(rowValue(row, ['Release Date', 'releaseDate'])),
      studio: textValue(rowValue(row, ['Studio', 'Publisher', 'publisher'])),
      author,
      rating: textValue(rowValue(row, ['Rating', 'rating'])),
      cardProductType: textValue(rowValue(row, ['Card Product Type', 'Sale Format', 'saleFormat'])),
      cardGame: textValue(rowValue(row, ['Card Game', 'cardGame'])),
      cardSport: textValue(rowValue(row, ['Sport', 'Card Sport', 'cardSport'])),
      cardSet: textValue(rowValue(row, ['Set', 'Card Set', 'cardSet'])),
      cardNumber: textValue(rowValue(row, ['Number', 'Card Number', 'Collector Number', 'cardNumber'])),
      cardProvider: textValue(rowValue(row, ['Card Provider', 'cardProvider'])),
      cardProviderId: textValue(rowValue(row, ['Card Provider ID', 'TCGplayer ID', 'cardProviderId'])),
      cardLanguage: textValue(rowValue(row, ['Language', 'Card Language', 'cardLanguage'])),
      cardRarity: textValue(rowValue(row, ['Rarity', 'cardRarity'])),
      cardFinish: textValue(rowValue(row, ['Finish', 'Printing', 'Foil', 'cardFinish'])),
      cardEdition: textValue(rowValue(row, ['Card Edition', 'cardEdition'])) || textValue(rowValue(row, ['Edition', 'edition'])),
      coverImageUrl: textValue(rowValue(row, ['Cover Image URL', 'coverImageUrl', 'Image URL'])),
      metadataSource: textValue(rowValue(row, ['Metadata Source', 'metadataSource'])) || 'AI/CSV Import',
      metadataConfidence: textValue(rowValue(row, ['Metadata Confidence', 'metadataConfidence', 'Confidence', 'confidence'])),
      collectionName: textValue(rowValue(row, ['Collection', 'Collection Name', 'collectionName'])),
      acquiredDate: textValue(rowValue(row, ['Acquired Date', 'Purchase Date', 'acquiredDate'])),
      listedDate: textValue(rowValue(row, ['Listed Date', 'listedDate'])),
      storageLocation: textValue(rowValue(row, ['Storage Location', 'Bin', 'Location', 'storageLocation'])),
      estLow: estimatedLow,
      estHigh: estimatedHigh,
      userLow: numberValue(rowValue(row, ['User Value Low', 'userLow'])),
      userHigh: numberValue(rowValue(row, ['User Value High', 'userHigh'])),
      valueSource: (textValue(rowValue(row, ['Value Source', 'valueSource'])) as InventoryItem['valueSource']) || (hasImportedValue ? 'AI/CSV Estimate' : 'Estimated'),
      needsValueCheck: explicitNeedsValueCheck ? /^(y|yes|true|1)$/i.test(explicitNeedsValueCheck) : !hasImportedValue,
      localLow: numberValue(rowValue(row, ['Local Low', 'localLow'])),
      localHigh: numberValue(rowValue(row, ['Local High', 'localHigh'])),
      priority,
      strategy: textValue(rowValue(row, ['Strategy', 'strategy'])) || priority,
      listingRecommendation,
      status: textValue(rowValue(row, ['Status', 'status'])) || 'Inventory',
      purchasePrice: numberValue(rowValue(row, ['Purchase Price', 'purchasePrice', 'Cost', 'Paid'])),
      soldPrice: numberValue(rowValue(row, ['Sold Price', 'soldPrice'])),
      fees: numberValue(rowValue(row, ['Fees', 'fees'])),
      shipping: numberValue(rowValue(row, ['Shipping', 'shipping'])),
      condition: textValue(rowValue(row, ['Condition', 'condition'])),
      completeness: textValue(rowValue(row, ['Completeness', 'completeness'])),
      complete: /^(y|yes|true|1)$/i.test(textValue(rowValue(row, ['Complete', 'complete']))),
      manual: /^(y|yes|true|1)$/i.test(textValue(rowValue(row, ['Manual', 'manual']))),
      aiDescription: textValue(rowValue(row, ['AI Description', 'aiDescription'])),
      itemDisclosures,
      confidence: textValue(rowValue(row, ['Confidence', 'confidence'])),
      ebayTitle: ebayTitle || [title, author, mediaFormat, releaseYear].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 80),
      ebayDescription,
      ebayCategory: textValue(rowValue(row, ['eBay Category', 'ebayCategory'])),
      ebayCategoryId: textValue(rowValue(row, ['eBay Category ID', 'Category ID', 'ebayCategoryId'])),
      ebayCondition: textValue(rowValue(row, ['eBay Condition', 'ebayCondition'])),
      ebayItemSpecifics: textValue(rowValue(row, ['eBay Item Specifics', 'ebayItemSpecifics'])),
      ebayPrice: suggestedPrice,
      ebayShipping: textValue(rowValue(row, ['eBay Shipping', 'ebayShipping'])),
      notes,
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
