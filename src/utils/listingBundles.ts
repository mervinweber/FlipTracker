export type BundleInventoryItem = {
  title: string;
  type?: string;
  console?: string;
  mediaFormat?: string;
  edition?: string;
  condition?: string;
  completeness?: string;
  author?: string;
  studio?: string;
  releaseYear?: string;
  upc?: string;
  barcode?: string;
  barcodeType?: string;
  purchasePrice?: number;
  ebayPrice?: number;
  estimatedLow?: number;
  estimatedHigh?: number;
  userLow?: number;
  userHigh?: number;
  valueSource?: string;
  cardGame?: string;
};

const TITLE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'blu', 'book', 'books', 'bundle', 'collection', 'complete', 'disc', 'discs',
  'dvd', 'edition', 'for', 'game', 'games', 'in', 'lot', 'movie', 'movies', 'of', 'on', 'ray',
  'season', 'set', 'the', 'to', 'vol', 'volume', 'with',
]);

function identity(item: BundleInventoryItem) {
  return `${item.type ?? ''} ${item.mediaFormat ?? ''}`.toLowerCase();
}

export function bundleFamily(item: BundleInventoryItem) {
  const value = identity(item);
  if (value.includes('book')) return 'books';
  if (value.includes('dvd') || value.includes('blu-ray') || value.includes('blu ray')) return 'movies';
  if (/\bcd\b|music/.test(value)) return 'music';
  if (value.includes('game')) return 'video-games';
  if (value.includes('card')) return `cards:${(item.cardGame || item.type || 'cards').toLowerCase()}`;
  if (value.includes('clothing') || value.includes('apparel')) return 'clothing';
  return `other:${(item.type || item.mediaFormat || 'general').toLowerCase()}`;
}

export function validateBundleItems(items: BundleInventoryItem[]) {
  if (items.length < 2) return 'Select at least two items for an eBay bundle.';
  if (items.length > 12) return 'An eBay bundle can contain up to 12 inventory items.';
  const family = bundleFamily(items[0]);
  if (items.some((item) => bundleFamily(item) !== family)) return 'Choose items from one compatible category family for a single eBay listing.';
  return undefined;
}

export function bundleSuggestedPrice(items: BundleInventoryItem[]) {
  const total = items.reduce((sum, item) => {
    const market = item.ebayPrice
      ?? (item.valueSource === 'User Override' ? item.userHigh ?? item.userLow : item.estimatedHigh ?? item.estimatedLow)
      ?? 0;
    return sum + market;
  }, 0);
  if (total <= 0) return undefined;
  return Math.max(0.99, Math.ceil(total * 0.9) - 0.01);
}

function commonValue(items: BundleInventoryItem[], valueFor: (item: BundleInventoryItem) => string | undefined) {
  const values = items.map((item) => valueFor(item)?.trim()).filter((value): value is string => Boolean(value));
  if (values.length !== items.length) return undefined;
  return values.every((value) => value.toLowerCase() === values[0].toLowerCase()) ? values[0] : undefined;
}

function sharedTitleWords(items: BundleInventoryItem[]) {
  const wordsByTitle = items.map((item) => (item.title.match(/[\p{L}\p{N}]+/gu) || [])
    .filter((word) => word.length > 1 && !/^\d+$/.test(word) && !TITLE_STOP_WORDS.has(word.toLowerCase())));
  const shared = new Set(
    wordsByTitle[0].slice(0, 4).map((word) => word.toLowerCase()),
  );
  for (const words of wordsByTitle.slice(1)) {
    const present = new Set(words.slice(0, 4).map((word) => word.toLowerCase()));
    for (const word of shared) if (!present.has(word)) shared.delete(word);
  }
  return wordsByTitle[0].filter((word) => shared.has(word.toLowerCase())).slice(0, 3).join(' ');
}

function fitEbayTitle(value: string) {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= 80) return compact;
  const shortened = compact.slice(0, 80).replace(/\s+\S*$/, '').replace(/[,:;+\-/]+$/, '').trim();
  return shortened || compact.slice(0, 80).trim();
}

function movieFormat(items: BundleInventoryItem[]) {
  const common = commonValue(items, (item) => item.mediaFormat || item.type);
  if (common && /blu[ -]?ray/i.test(common)) return 'Blu-ray';
  if (common && /dvd/i.test(common)) return 'DVD';
  return 'DVD & Blu-ray';
}

export function bundleTitle(items: BundleInventoryItem[]) {
  if (!items.length) return 'Media Lot';
  const family = bundleFamily(items[0]);
  const count = items.length;
  const sharedSubject = sharedTitleWords(items);
  const commonAuthor = commonValue(items, (item) => item.author);
  const commonFormat = commonValue(items, (item) => item.mediaFormat);
  const commonConsole = commonValue(items, (item) => item.console);

  if (family === 'books') {
    const subject = sharedSubject || commonAuthor;
    return fitEbayTitle(`${subject ? `${subject} ` : ''}Lot of ${count} Books${commonFormat ? ` ${commonFormat}` : ''} Mixed Titles`);
  }
  if (family === 'movies') {
    return fitEbayTitle(`${sharedSubject ? `${sharedSubject} ` : ''}Lot of ${count} ${movieFormat(items)} Movies Mixed Titles`);
  }
  if (family === 'music') {
    return fitEbayTitle(`${sharedSubject ? `${sharedSubject} ` : ''}Lot of ${count} CDs Music Collection`);
  }
  if (family === 'video-games') {
    return fitEbayTitle(`${sharedSubject ? `${sharedSubject} ` : ''}Lot of ${count}${commonConsole ? ` ${commonConsole}` : ''} Video Games`);
  }
  if (family.startsWith('cards:')) {
    const cardGame = commonValue(items, (item) => item.cardGame);
    return fitEbayTitle(`${sharedSubject || cardGame || 'Trading Card'} Lot of ${count} Cards`);
  }
  if (family === 'clothing') return fitEbayTitle(`Lot of ${count} Clothing Items Mixed Apparel`);
  return fitEbayTitle(`${sharedSubject ? `${sharedSubject} ` : ''}Lot of ${count} Mixed Items`);
}

function identifierDetail(item: BundleInventoryItem) {
  const identifier = (item.upc || item.barcode || '').trim();
  if (!identifier) return undefined;
  const compactType = (item.barcodeType || '').toLowerCase();
  const compactIdentifier = identifier.replace(/[^0-9X]/gi, '').toUpperCase();
  const label = compactType.includes('isbn') || /^97[89]\d{10}$/.test(compactIdentifier) || /^\d{9}[\dX]$/.test(compactIdentifier)
    ? 'ISBN'
    : compactType.includes('ean') ? 'EAN' : 'UPC';
  return `${label}: ${identifier}`;
}

export function bundleDescription(items: BundleInventoryItem[]) {
  const lines = items.flatMap((item, index) => {
    const details = [
      item.author ? `Author: ${item.author}` : '',
      item.console ? `Platform: ${item.console}` : '',
      item.mediaFormat ? `Format: ${item.mediaFormat}` : '',
      item.edition ? `Edition: ${item.edition}` : '',
      item.studio ? `Publisher/Studio: ${item.studio}` : '',
      item.releaseYear ? `Release year: ${item.releaseYear}` : '',
      identifierDetail(item) || '',
      item.condition ? `Condition: ${item.condition}` : '',
      item.completeness ? `Completeness: ${item.completeness}` : '',
    ].filter(Boolean);
    return [`${index + 1}. ${item.title}`, ...(details.length ? [`   ${details.join(' | ')}`] : [])];
  });
  return [
    `Bundle lot of ${items.length} items. Everything included is listed below:`,
    '',
    ...lines,
    '',
    'Items are pre-owned unless noted otherwise. Review all actual photos for the exact items and condition.',
    'The entire lot is sold together as one listing.',
  ].join('\n');
}
