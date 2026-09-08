export type BundleInventoryItem = {
  title: string;
  type?: string;
  mediaFormat?: string;
  edition?: string;
  condition?: string;
  purchasePrice?: number;
  ebayPrice?: number;
  estimatedLow?: number;
  estimatedHigh?: number;
  userLow?: number;
  userHigh?: number;
  valueSource?: string;
  cardGame?: string;
};

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

export function bundleTitle(items: BundleInventoryItem[]) {
  const family = bundleFamily(items[0]);
  const label = family === 'books' ? 'Book' : family === 'movies' ? 'DVD Blu-ray' : family === 'music' ? 'CD' : family === 'video-games' ? 'Video Game' : family.startsWith('cards:') ? 'Trading Card' : family === 'clothing' ? 'Clothing' : 'Mixed Item';
  const leadTitles = items.slice(0, 2).map((item) => item.title.trim()).filter(Boolean).join(' + ');
  return `${leadTitles} ${items.length} ${label} Lot Bundle`.replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function bundleDescription(items: BundleInventoryItem[]) {
  const lines = items.map((item, index) => `${index + 1}. ${item.title}${item.edition ? ` - ${item.edition}` : ''}${item.condition ? ` (${item.condition})` : ''}`);
  return [
    `Bundle lot of ${items.length} items. Everything included is listed below:`,
    '',
    ...lines,
    '',
    'Items are pre-owned unless noted otherwise. Review all actual photos for the exact items and condition.',
    'The entire lot is sold together as one listing.',
  ].join('\n');
}

