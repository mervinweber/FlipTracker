export type CrossListPlatform = 'Mercari' | 'Depop' | 'Vinted';
export type CrossListFamily = 'book' | 'media' | 'videoGame' | 'card' | 'clothing' | 'general';

export type CrossListSource = {
  platform?: string;
  title?: string;
  description?: string;
  type?: string;
  mediaFormat?: string;
  condition?: string;
  price?: number;
  sku?: string;
  barcode?: string;
  photoUrls?: string[];
  sourceType?: string;
  sourceListingId?: string;
  platformCategory?: string;
  notes?: string;
};

export const CROSS_LIST_PLATFORMS: CrossListPlatform[] = ['Mercari', 'Depop', 'Vinted'];
export const CROSS_LIST_STATUSES = ['Ready', 'Needs Review', 'Listed', 'Sold', 'Ended'] as const;

export const CROSS_LIST_CATEGORY_OPTIONS: Record<CrossListPlatform, string[]> = {
  Mercari: [
    'Books',
    'Books > Comic Books',
    'Books > Manga',
    'Electronics > Movies & TV',
    'Electronics > Movies & TV > DVDs',
    'Electronics > Movies & TV > Blu-ray',
    'Electronics > Video Games',
    'Electronics > Video Games > Games',
    'Collectibles > Trading Cards',
    'Collectibles > Trading Cards > Pokemon',
    'Collectibles > Trading Cards > Yu-Gi-Oh!',
    'Collectibles > Trading Cards > Sports',
    'Women > Clothing',
    'Men > Clothing',
    'Kids > Clothing',
    'Toys & Games',
    'Home',
    'Other',
  ],
  Depop: [
    'Books & Media',
    'Books & Media > Books',
    'Books & Media > Comics & Graphic Novels',
    'Film / DVDs',
    'Film / DVDs > DVD',
    'Film / DVDs > Blu-ray',
    'Video Games',
    'Collectibles',
    'Collectibles > Trading Cards',
    'Womenswear',
    'Menswear',
    'Kidswear',
    'Home',
    'Everything Else',
  ],
  Vinted: [
    'Entertainment > Books',
    'Entertainment > Movies & TV',
    'Entertainment > Video Games',
    'Entertainment > Collectibles',
    'Clothing',
    'Accessories',
    'Home',
    'Other',
  ],
};

export function publicCrossListPhotoUrls(photoUrls?: string[]) {
  return (photoUrls || []).filter((url) => /^https:\/\//i.test(url));
}

export function crossListTitleLimit(platform?: string) {
  if (platform === 'Mercari') return 80;
  if (platform === 'Depop') return 80;
  return 80;
}

export function crossListFamily(type?: string, mediaFormat?: string): CrossListFamily {
  const value = `${type || ''} ${mediaFormat || ''}`.toLowerCase();
  if (value.includes('book') || value.includes('graphic novel') || value.includes('manga')) return 'book';
  if (value.includes('dvd') || value.includes('blu') || value.includes('cd') || value.includes('movie')) return 'media';
  if (value.includes('game')) return 'videoGame';
  if (value.includes('card') || value.includes('pokemon') || value.includes('yu-gi') || value.includes('sports')) return 'card';
  if (value.includes('cloth') || value.includes('apparel') || value.includes('shirt') || value.includes('jean')) return 'clothing';
  return 'general';
}

export function defaultCrossListCategory(platform: string, type?: string, mediaFormat?: string) {
  const family = crossListFamily(type, mediaFormat);
  const value = `${type || ''} ${mediaFormat || ''}`.toLowerCase();
  if (platform === 'Mercari') {
    if (family === 'book') {
      if (value.includes('comic') || value.includes('graphic novel')) return 'Books > Comic Books';
      if (value.includes('manga')) return 'Books > Manga';
      return 'Books';
    }
    if (family === 'media') {
      if (value.includes('blu')) return 'Electronics > Movies & TV > Blu-ray';
      if (value.includes('dvd')) return 'Electronics > Movies & TV > DVDs';
      return 'Electronics > Movies & TV';
    }
    if (family === 'videoGame') return 'Electronics > Video Games';
    if (family === 'card') {
      if (value.includes('pokemon')) return 'Collectibles > Trading Cards > Pokemon';
      if (value.includes('yu-gi')) return 'Collectibles > Trading Cards > Yu-Gi-Oh!';
      if (value.includes('sports')) return 'Collectibles > Trading Cards > Sports';
      return 'Collectibles > Trading Cards';
    }
    if (family === 'clothing') return 'Men > Clothing';
    return 'Other';
  }
  if (platform === 'Vinted') {
    if (family === 'book') return 'Entertainment > Books';
    if (family === 'media') return 'Entertainment > Movies & TV';
    if (family === 'videoGame') return 'Entertainment > Video Games';
    if (family === 'card') return 'Entertainment > Collectibles';
    if (family === 'clothing') return 'Clothing';
    return 'Other';
  }
  if (family === 'book') {
    if (value.includes('comic') || value.includes('graphic novel') || value.includes('manga')) return 'Books & Media > Comics & Graphic Novels';
    return 'Books & Media > Books';
  }
  if (family === 'media') {
    if (value.includes('blu')) return 'Film / DVDs > Blu-ray';
    if (value.includes('dvd')) return 'Film / DVDs > DVD';
    return 'Film / DVDs';
  }
  if (family === 'videoGame') return 'Video Games';
  if (family === 'card') return 'Collectibles > Trading Cards';
  if (family === 'clothing') return 'Menswear';
  return 'Everything Else';
}

export function normalizeCrossListCondition(condition?: string, type?: string, mediaFormat?: string) {
  const value = (condition || '').toLowerCase();
  const family = crossListFamily(type, mediaFormat);
  if (family === 'clothing') {
    if (value.includes('tag')) return 'New with tags';
    if (value.includes('new')) return 'New without tags';
    if (value.includes('like')) return 'Like new';
    if (value.includes('fair') || value.includes('acceptable') || value.includes('poor')) return 'Fair';
    return 'Good';
  }
  if (value.includes('new') || value.includes('sealed')) return 'Like New';
  if (value.includes('very good') || value.includes('like')) return 'Like New';
  if (value.includes('acceptable') || value.includes('fair') || value.includes('poor')) return 'Acceptable';
  return 'Good';
}

export function crossListStatusFor(source: CrossListSource) {
  const missing: string[] = [];
  if (!source.title?.trim()) missing.push('title');
  if (!source.price || source.price <= 0) missing.push('price');
  if (!source.description?.trim()) missing.push('description');
  if (!publicCrossListPhotoUrls(source.photoUrls).length) missing.push('public photo');
  if ((source.title?.trim().length || 0) > crossListTitleLimit(source.platform)) missing.push('shorter title');
  return { status: missing.length ? 'Needs Review' : 'Ready', missing };
}

export function buildCrossListDescription(source: CrossListSource) {
  const parts = [
    source.description?.trim(),
    source.barcode ? `Identifier: ${source.barcode}` : '',
    source.notes?.trim(),
  ].filter(Boolean);
  return parts.join('\n\n').slice(0, 1000);
}

export function buildCrossListClipboardPack(source: CrossListSource) {
  return [
    `Title: ${source.title || ''}`,
    `Price: ${source.price !== undefined ? `$${source.price.toFixed(2)}` : ''}`,
    `Category: ${source.platformCategory || defaultCrossListCategory(source.platform || 'Mercari', source.type, source.mediaFormat)}`,
    `Condition: ${normalizeCrossListCondition(source.condition, source.type, source.mediaFormat)}`,
    `SKU: ${source.sku || ''}`,
    source.barcode ? `Identifier: ${source.barcode}` : '',
    '',
    buildCrossListDescription(source),
  ].filter((line, index, lines) => line || lines[index - 1]).join('\n');
}

function csvEscape(value: string | number | undefined) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildDepopCsv(rows: CrossListSource[]) {
  const headers = [
    'Description',
    'Category',
    'Price',
    'Brand',
    'Condition',
    'Size',
    'Color 1',
    'Color 2',
    'Source 1',
    'Source 2',
    'Age',
    'Style 1',
    'Style 2',
    'Style 3',
    'Location',
    'Picture Hero url',
    'Picture 2 url',
    'Picture 3 url',
    'Picture 4 url',
    'Picture 5 url',
    'Picture 6 url',
    'Picture 7 url',
    'Picture 8 url',
    'Domestic Shipping price',
    'International Shipping price',
    'SKU',
  ];
  const version = [`Template version: 6`, ...Array(headers.length - 1).fill('')];
  const instruction = Array(headers.length).fill('');
  const body = rows.map((row) => {
    const photos = publicCrossListPhotoUrls(row.photoUrls).slice(0, 8);
    while (photos.length < 8) photos.push('');
    return [
      buildCrossListDescription(row),
      row.platformCategory || defaultCrossListCategory('Depop', row.type, row.mediaFormat),
      row.price?.toFixed(2) || '',
      'Other (unbranded)',
      normalizeCrossListCondition(row.condition, row.type, row.mediaFormat),
      '',
      '',
      '',
      'Preloved (preloved)',
      '',
      '',
      '',
      '',
      '',
      '',
      ...photos,
      '',
      '',
      row.sku || '',
    ];
  });
  return [version, headers, instruction, ...body].map((row) => row.map(csvEscape).join(',')).join('\n') + '\n';
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
