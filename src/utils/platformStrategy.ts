export const LISTING_PLATFORMS = ['eBay', 'Vinted', 'Mercari', 'Depop'] as const;

export type ListingPlatform = typeof LISTING_PLATFORMS[number];

export type PlatformStrategy = {
  family: string;
  label: string;
  primary: ListingPlatform[];
  optional: ListingPlatform[];
  skip: ListingPlatform[];
  note: string;
};

type StrategyInput = {
  type?: string;
  mediaFormat?: string;
  title?: string;
  console?: string;
};

function familyFor(item: StrategyInput) {
  const value = `${item.type || ''} ${item.mediaFormat || ''} ${item.title || ''} ${item.console || ''}`.toLowerCase();
  if (value.includes('book') || value.includes('graphic novel') || value.includes('manga') || value.includes('isbn')) return 'books';
  if (value.includes('dvd') || value.includes('blu') || value.includes('movie') || value.includes('cd')) return 'media';
  if (value.includes('game') || value.includes('xbox') || value.includes('playstation') || value.includes('nintendo')) return 'games';
  if (value.includes('pokemon') || value.includes('yu-gi') || value.includes('card') || value.includes('tcg')) return 'cards';
  if (value.includes('cloth') || value.includes('apparel') || value.includes('shirt') || value.includes('jean') || value.includes('shoe')) return 'clothing';
  if (value.includes('electronic') || value.includes('router') || value.includes('camera') || value.includes('phone') || value.includes('tablet')) return 'electronics';
  return 'general';
}

const STRATEGIES: Record<string, PlatformStrategy> = {
  books: {
    family: 'books',
    label: 'Books / Graphic Novels',
    primary: ['eBay', 'Vinted'],
    optional: ['Mercari'],
    skip: ['Depop'],
    note: 'Books usually start on eBay and can be manually tracked on Vinted. Use Mercari for higher-value or bundle-friendly books.',
  },
  media: {
    family: 'media',
    label: 'DVDs / Blu-rays / CDs',
    primary: ['eBay'],
    optional: ['Mercari', 'Vinted'],
    skip: ['Depop'],
    note: 'Most disc media is eBay-first. Mercari can work for bundles or recognizable sets.',
  },
  games: {
    family: 'games',
    label: 'Video Games',
    primary: ['eBay', 'Mercari'],
    optional: ['Vinted'],
    skip: ['Depop'],
    note: 'Games are strong on eBay and Mercari. Vinted can stay manual unless you want to test a specific lot.',
  },
  cards: {
    family: 'cards',
    label: 'TCG / Sports Cards',
    primary: ['eBay'],
    optional: ['Mercari'],
    skip: ['Vinted', 'Depop'],
    note: 'Cards stay eBay-first unless you want a Mercari handoff for lots or higher-value singles.',
  },
  clothing: {
    family: 'clothing',
    label: 'Clothing',
    primary: ['Vinted'],
    optional: ['Mercari', 'Depop', 'eBay'],
    skip: [],
    note: 'Clothing starts with Vinted for your current workflow, with Mercari/Depop/eBay available when the item warrants it.',
  },
  electronics: {
    family: 'electronics',
    label: 'Electronics',
    primary: ['eBay', 'Mercari'],
    optional: [],
    skip: ['Vinted', 'Depop'],
    note: 'Electronics are eBay and Mercari first. Skip fashion-focused marketplaces by default.',
  },
  general: {
    family: 'general',
    label: 'General Merchandise',
    primary: ['eBay'],
    optional: ['Mercari'],
    skip: ['Vinted', 'Depop'],
    note: 'Start general items on eBay, then add Mercari when comps or category fit look promising.',
  },
};

export function platformStrategyFor(item: StrategyInput) {
  return STRATEGIES[familyFor(item)] || STRATEGIES.general;
}

export function defaultPlatformsFor(item: StrategyInput) {
  return platformStrategyFor(item).primary;
}

