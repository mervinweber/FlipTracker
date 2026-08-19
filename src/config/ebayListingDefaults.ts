export type EbayListingItemType =
  | 'Book'
  | 'Video Game'
  | 'DVD'
  | 'Blu-ray'
  | 'CD'
  | 'Pokemon Card'
  | 'Yu-Gi-Oh! Card'
  | 'Sports Card'
  | 'Clothing'
  | 'General Merchandise';

export type EbayCategoryKey =
  | 'book'
  | 'video-game'
  | 'dvd'
  | 'blu-ray'
  | 'cd'
  | 'pokemon-card'
  | 'yugioh-card'
  | 'sports-card'
  | 'clothing'
  | 'general-merchandise';

export type CardSaleFormat = 'single-card' | 'lot' | 'complete-set' | 'sealed-pack' | 'sealed-box';

export type EbayCategoryChoice = {
  key: EbayCategoryKey;
  label: string;
  itemType: EbayListingItemType;
  categoryId?: string;
  categoryName: string;
  requiresLeafSelection: boolean;
  cardCategoryIds?: Readonly<Record<CardSaleFormat, string>>;
};

const COLLECTIBLE_CARD_CATEGORY_IDS = {
  'single-card': '183454',
  lot: '183455',
  'complete-set': '183459',
  'sealed-pack': '183456',
  'sealed-box': '261044',
} as const satisfies Readonly<Record<CardSaleFormat, string>>;

const SPORTS_CARD_CATEGORY_IDS = {
  'single-card': '261328',
  lot: '261329',
  'complete-set': '261330',
  'sealed-pack': '261331',
  'sealed-box': '261332',
} as const satisfies Readonly<Record<CardSaleFormat, string>>;

export const EBAY_CATEGORY_CHOICES = [
  {
    key: 'book',
    label: 'Books',
    itemType: 'Book',
    categoryId: '261186',
    categoryName: 'Books & Magazines > Books',
    requiresLeafSelection: false,
  },
  {
    key: 'video-game',
    label: 'Video Games',
    itemType: 'Video Game',
    categoryId: '139973',
    categoryName: 'Video Games & Consoles > Video Games',
    requiresLeafSelection: false,
  },
  {
    key: 'dvd',
    label: 'DVDs',
    itemType: 'DVD',
    categoryId: '617',
    categoryName: 'Movies & TV > DVDs & Blu-ray Discs',
    requiresLeafSelection: false,
  },
  {
    key: 'blu-ray',
    label: 'Blu-rays',
    itemType: 'Blu-ray',
    categoryId: '617',
    categoryName: 'Movies & TV > DVDs & Blu-ray Discs',
    requiresLeafSelection: false,
  },
  {
    key: 'cd',
    label: 'CDs',
    itemType: 'CD',
    categoryId: '176984',
    categoryName: 'Music > CDs',
    requiresLeafSelection: false,
  },
  {
    key: 'pokemon-card',
    label: 'Pokemon Cards',
    itemType: 'Pokemon Card',
    categoryId: COLLECTIBLE_CARD_CATEGORY_IDS['single-card'],
    categoryName: 'Collectible Card Games > Pokemon Trading Card Game',
    requiresLeafSelection: false,
    cardCategoryIds: COLLECTIBLE_CARD_CATEGORY_IDS,
  },
  {
    key: 'yugioh-card',
    label: 'Yu-Gi-Oh! Cards',
    itemType: 'Yu-Gi-Oh! Card',
    categoryId: COLLECTIBLE_CARD_CATEGORY_IDS['single-card'],
    categoryName: 'Collectible Card Games > Yu-Gi-Oh! Trading Card Game',
    requiresLeafSelection: false,
    cardCategoryIds: COLLECTIBLE_CARD_CATEGORY_IDS,
  },
  {
    key: 'sports-card',
    label: 'Sports Cards',
    itemType: 'Sports Card',
    categoryId: SPORTS_CARD_CATEGORY_IDS['single-card'],
    categoryName: 'Sports Mem, Cards & Fan Shop > Sports Trading Cards',
    requiresLeafSelection: false,
    cardCategoryIds: SPORTS_CARD_CATEGORY_IDS,
  },
  {
    key: 'clothing',
    label: 'Clothing',
    itemType: 'Clothing',
    categoryName: 'Clothing, Shoes & Accessories',
    requiresLeafSelection: true,
  },
  {
    key: 'general-merchandise',
    label: 'General Merchandise',
    itemType: 'General Merchandise',
    categoryName: 'General Merchandise',
    requiresLeafSelection: true,
  },
] as const satisfies readonly EbayCategoryChoice[];

export type CategoryResolutionInput = {
  itemType?: string | null;
  barcode?: string | null;
  barcodeType?: string | null;
  cardSaleFormat?: CardSaleFormat | string | null;
};

export type EbayCategoryResolution = {
  choice: EbayCategoryChoice;
  categoryId?: string;
  source: 'item-type' | 'isbn' | 'barcode-fallback' | 'fallback';
  isAutomatic: boolean;
  requiresLeafSelection: boolean;
};

const ITEM_TYPE_ALIASES: Readonly<Record<string, EbayCategoryKey>> = {
  book: 'book',
  books: 'book',
  isbn: 'book',
  game: 'video-game',
  games: 'video-game',
  videogame: 'video-game',
  videogames: 'video-game',
  dvd: 'dvd',
  dvds: 'dvd',
  bluray: 'blu-ray',
  blurays: 'blu-ray',
  cd: 'cd',
  cds: 'cd',
  music: 'cd',
  pokemoncard: 'pokemon-card',
  pokemoncards: 'pokemon-card',
  pokemontcg: 'pokemon-card',
  yugiohcard: 'yugioh-card',
  yugiohcards: 'yugioh-card',
  yugiohtcg: 'yugioh-card',
  sportscard: 'sports-card',
  sportscards: 'sports-card',
  clothing: 'clothing',
  clothes: 'clothing',
  apparel: 'clothing',
  generalmerchandise: 'general-merchandise',
  merchandise: 'general-merchandise',
  misc: 'general-merchandise',
  other: 'general-merchandise',
};

function compact(value?: string | null) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function barcodeCharacters(value?: string | null) {
  return (value ?? '').toUpperCase().replace(/[^0-9X]/g, '');
}

function hasValidIsbn10Checksum(value: string) {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  const total = [...value].reduce((sum, character, index) => {
    const digit = character === 'X' ? 10 : Number(character);
    return sum + digit * (10 - index);
  }, 0);
  return total % 11 === 0;
}

function hasValidIsbn13Checksum(value: string) {
  if (!/^97[89]\d{10}$/.test(value)) return false;
  const expected = Number(value[12]);
  const total = [...value.slice(0, 12)].reduce(
    (sum, character, index) => sum + Number(character) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return (10 - (total % 10)) % 10 === expected;
}

export function isIsbnBarcode(barcode?: string | null, barcodeType?: string | null) {
  if (compact(barcodeType).includes('isbn')) return true;
  const normalized = barcodeCharacters(barcode);
  return hasValidIsbn10Checksum(normalized) || hasValidIsbn13Checksum(normalized);
}

export function isProductBarcode(barcode?: string | null) {
  const normalized = barcodeCharacters(barcode);
  return /^\d{8}$|^\d{12,14}$/.test(normalized);
}

export function categoryChoiceForKey(key: EbayCategoryKey): EbayCategoryChoice {
  return EBAY_CATEGORY_CHOICES.find((choice) => choice.key === key) ?? EBAY_CATEGORY_CHOICES[9];
}

function normalizedCardSaleFormat(value?: string | null): CardSaleFormat {
  const normalized = compact(value);
  if (normalized.includes('lot')) return 'lot';
  if (normalized.includes('completeset') || normalized === 'set') return 'complete-set';
  if (normalized.includes('sealedpack') || normalized === 'pack') return 'sealed-pack';
  if (normalized.includes('sealedbox') || normalized === 'box') return 'sealed-box';
  return 'single-card';
}

export function resolveEbayCategory(input: CategoryResolutionInput): EbayCategoryResolution {
  const itemTypeKey = ITEM_TYPE_ALIASES[compact(input.itemType)];
  const isbn = isIsbnBarcode(input.barcode, input.barcodeType);
  const source: EbayCategoryResolution['source'] = itemTypeKey
    ? 'item-type'
    : isbn
      ? 'isbn'
      : isProductBarcode(input.barcode)
        ? 'barcode-fallback'
        : 'fallback';
  const key = itemTypeKey ?? (isbn ? 'book' : 'general-merchandise');
  const choice = categoryChoiceForKey(key);
  const cardCategoryId = choice.cardCategoryIds?.[normalizedCardSaleFormat(input.cardSaleFormat)];
  const categoryId = cardCategoryId ?? choice.categoryId;

  return {
    choice,
    categoryId,
    source,
    isAutomatic: Boolean(categoryId) && !choice.requiresLeafSelection,
    requiresLeafSelection: choice.requiresLeafSelection || !categoryId,
  };
}

export type EbayShippingProfileKey =
  | 'single-media'
  | 'single-book'
  | 'multi-media'
  | 'trading-card'
  | 'lightweight-clothing'
  | 'boxed-clothing'
  | 'custom';

export type ShippingWeight = {
  value: number;
  unit: 'OUNCE';
};

export type ShippingDimensions = {
  length: number;
  width: number;
  height: number;
  unit: 'INCH';
};

export type EbayShippingProfile = {
  key: EbayShippingProfileKey;
  label: string;
  description: string;
  weight: ShippingWeight;
  dimensions: ShippingDimensions;
  packageStyle: 'padded-envelope' | 'rigid-mailer' | 'poly-mailer' | 'box';
  policyNameHints: readonly string[];
  requiresMeasuredValues: boolean;
};

export const EBAY_SHIPPING_PROFILES = [
  {
    key: 'single-media',
    label: 'Single Media Item',
    description: 'One DVD, Blu-ray, CD, or standard game in a padded mailer.',
    weight: { value: 8, unit: 'OUNCE' },
    dimensions: { length: 10, width: 7, height: 1, unit: 'INCH' },
    packageStyle: 'padded-envelope',
    policyNameHints: ['Media Mail', 'Single Media', 'USPS Ground Advantage'],
    requiresMeasuredValues: false,
  },
  {
    key: 'single-book',
    label: 'Single Book',
    description: 'One average paperback or hardcover packed for Media Mail; weigh larger books before publishing.',
    weight: { value: 16, unit: 'OUNCE' },
    dimensions: { length: 10, width: 8, height: 2, unit: 'INCH' },
    packageStyle: 'padded-envelope',
    policyNameHints: ['Media Mail', 'Single Book', 'Calculated Media'],
    requiresMeasuredValues: false,
  },
  {
    key: 'multi-media',
    label: 'Multiple Media Items',
    description: 'A small media bundle or a heavier book shipment packed in a box.',
    weight: { value: 32, unit: 'OUNCE' },
    dimensions: { length: 12, width: 10, height: 6, unit: 'INCH' },
    packageStyle: 'box',
    policyNameHints: ['Media Mail', 'Multi Media', 'Calculated Media'],
    requiresMeasuredValues: false,
  },
  {
    key: 'trading-card',
    label: 'Trading Card',
    description: 'A protected single card in a rigid mailer or card-safe envelope.',
    weight: { value: 3, unit: 'OUNCE' },
    dimensions: { length: 7, width: 5, height: 0.25, unit: 'INCH' },
    packageStyle: 'rigid-mailer',
    policyNameHints: ['eBay Standard Envelope', 'Trading Card', 'USPS Ground Advantage'],
    requiresMeasuredValues: false,
  },
  {
    key: 'lightweight-clothing',
    label: 'Lightweight Clothing',
    description: 'A shirt, shorts, or another lightweight garment in a poly mailer.',
    weight: { value: 12, unit: 'OUNCE' },
    dimensions: { length: 12, width: 10, height: 2, unit: 'INCH' },
    packageStyle: 'poly-mailer',
    policyNameHints: ['Lightweight Clothing', 'USPS Ground Advantage', 'Calculated Clothing'],
    requiresMeasuredValues: false,
  },
  {
    key: 'boxed-clothing',
    label: 'Boxed Clothing',
    description: 'Jeans, a jacket, shoes, or multiple garments packed in a box.',
    weight: { value: 32, unit: 'OUNCE' },
    dimensions: { length: 14, width: 12, height: 6, unit: 'INCH' },
    packageStyle: 'box',
    policyNameHints: ['Boxed Clothing', 'UPS Ground', 'FedEx Ground', 'Calculated Shipping'],
    requiresMeasuredValues: false,
  },
  {
    key: 'custom',
    label: 'Custom Package',
    description: 'A starting point for unusual items; weigh and measure before publishing.',
    weight: { value: 32, unit: 'OUNCE' },
    dimensions: { length: 12, width: 10, height: 6, unit: 'INCH' },
    packageStyle: 'box',
    policyNameHints: ['Custom', 'Calculated Shipping', 'USPS Ground Advantage', 'UPS Ground'],
    requiresMeasuredValues: true,
  },
] as const satisfies readonly EbayShippingProfile[];

export function shippingProfileForKey(key: EbayShippingProfileKey): EbayShippingProfile {
  return EBAY_SHIPPING_PROFILES.find((profile) => profile.key === key)
    ?? EBAY_SHIPPING_PROFILES.find((profile) => profile.key === 'custom')!;
}

export function resolveShippingProfile(input: { itemType?: string | null; mediaFormat?: string | null; title?: string | null }) {
  const identity = `${input.itemType ?? ''} ${input.mediaFormat ?? ''} ${input.title ?? ''}`.toLowerCase();
  if (/card|pokemon|pokémon|yu-gi-oh|yugioh|tcg|ccg/.test(identity)) return shippingProfileForKey('trading-card');
  if (/clothing|apparel|shirt|blouse|shorts|skirt|dress|sweater|hoodie/.test(identity)) return shippingProfileForKey('lightweight-clothing');
  if (/jeans|jacket|coat|shoe|boot|multiple garments|clothing lot/.test(identity)) return shippingProfileForKey('boxed-clothing');
  if (/book lot|bundle|box set|boxset|collection|2[- ]?4|multiple/.test(identity)) return shippingProfileForKey('multi-media');
  if (/book/.test(identity)) return shippingProfileForKey('single-book');
  if (/dvd|blu|cd|music|game/.test(identity)) return shippingProfileForKey('single-media');
  return shippingProfileForKey('custom');
}

export function findSuggestedShippingPolicy<T extends { id: string; name: string }>(policies: readonly T[], profile: EbayShippingProfile) {
  const normalizedHints = profile.policyNameHints.map((hint) => hint.toLowerCase());
  return policies.find((policy) => normalizedHints.some((hint) => policy.name.toLowerCase().includes(hint)))
    ?? policies.find((policy) => profile.key === 'single-media' && policy.name.toLowerCase().includes('media'));
}
