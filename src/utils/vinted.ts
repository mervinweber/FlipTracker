export const VINTED_CATEGORIES = [
  'Books',
  'Movies & TV',
  'Music',
  'Video Games',
  "Women's Clothing",
  "Men's Clothing",
  "Kids' Clothing",
  'Shoes',
  'Accessories',
  'Home',
  'Electronics',
  'Collectibles',
  'Toys & Games',
  'Other',
] as const;

export const VINTED_HOME_URL = 'https://www.vinted.com/';

export function isVintedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return host === 'vinted.com' || host.startsWith('vinted.') || host.includes('.vinted.');
}

export function normalizeVintedListingUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (!isVintedHost(url.hostname) || !/^\/items\/\d+/i.test(url.pathname)) return '';
    url.protocol = 'https:';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function vintedListingId(value: string) {
  const normalized = normalizeVintedListingUrl(value);
  return normalized.match(/\/items\/(\d+)/i)?.[1] || '';
}

export function suggestedVintedCategory(assetType?: string, title?: string) {
  const text = `${assetType || ''} ${title || ''}`.toLowerCase();
  if (text.includes('book') || text.includes('isbn')) return 'Books';
  if (text.includes('dvd') || text.includes('blu-ray') || text.includes('movie')) return 'Movies & TV';
  if (text.includes('cd') || text.includes('vinyl') || text.includes('music')) return 'Music';
  if (text.includes('video game') || text.includes('playstation') || text.includes('xbox') || text.includes('nintendo')) return 'Video Games';
  if (text.includes('pokemon') || text.includes('yu-gi') || text.includes('sports card') || text.includes('collectible')) return 'Collectibles';
  if (text.includes('toy')) return 'Toys & Games';
  if (text.includes('shoe') || text.includes('sneaker') || text.includes('boot')) return 'Shoes';
  if (text.includes('clothing') || text.includes('shirt') || text.includes('dress') || text.includes('jacket')) return "Women's Clothing";
  return 'Other';
}
