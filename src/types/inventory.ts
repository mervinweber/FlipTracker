export type ItemType = 'Video Game' | 'DVD' | 'Blu-ray' | 'CD' | 'Book' | 'Pokemon Card' | 'Sports Card' | 'Yu-Gi-Oh! Card' | 'Toy' | 'Other Media' | 'General Merchandise' | 'Misc';

export type ListingRecommendation = 'Sell Individually' | 'Bundle' | 'Skip' | 'Review';

export type InventoryItem = {
  id?: number;
  type: ItemType;
  console?: string;
  title: string;
  edition?: string;
  mediaFormat?: string;
  upc?: string;
  barcode?: string;
  barcodeType?: string;
  releaseYear?: string;
  releaseDate?: string;
  studio?: string;
  author?: string;
  rating?: string;
  cardProductType?: string;
  cardGame?: string;
  cardSport?: string;
  cardSet?: string;
  cardNumber?: string;
  cardPlayer?: string;
  cardTeam?: string;
  cardProvider?: string;
  cardProviderId?: string;
  cardLanguage?: string;
  cardRarity?: string;
  cardFinish?: string;
  cardEdition?: string;
  cardIdentificationMethod?: string;
  cardIdentificationConfidence?: number;
  coverImageUrl?: string;
  photoDataUrl?: string;
  metadataSource?: string;
  metadataConfidence?: string;
  collectionName?: string;
  storageLocation?: string;
  estLow?: number;
  estHigh?: number;
  localLow?: number;
  localHigh?: number;
  userLow?: number;
  userHigh?: number;
  valueSource?: 'Estimated' | 'User Override';
  needsValueCheck?: boolean;
  priority?: string;
  strategy?: string;
  listingRecommendation?: ListingRecommendation;
  status?: string;
  purchasePrice?: number;
  soldPrice?: number;
  fees?: number;
  shipping?: number;
  condition?: string;
  completeness?: string;
  complete?: boolean;
  manual?: boolean;
  listed?: boolean;
  sold?: boolean;
  aiDescription?: string;
  itemDisclosures?: string;
  notes?: string;
  confidence?: string;
  ebayTitle?: string;
  ebayDescription?: string;
  ebayCategory?: string;
  ebayCategoryId?: string;
  ebayCondition?: string;
  ebayItemSpecifics?: string;
  ebayPrice?: number;
  ebayShipping?: string;
  createdAt: string;
  updatedAt: string;
};

export function effectiveLow(item: InventoryItem): number {
  return item.valueSource === 'User Override' ? (item.userLow || 0) : (item.estLow || 0);
}

export function effectiveHigh(item: InventoryItem): number {
  return item.valueSource === 'User Override' ? (item.userHigh || 0) : (item.estHigh || 0);
}

export function effectiveAverage(item: InventoryItem): number {
  return (effectiveLow(item) + effectiveHigh(item)) / 2;
}

export function profit(item: InventoryItem): number {
  return (item.soldPrice || 0) - (item.purchasePrice || 0) - (item.fees || 0) - (item.shipping || 0);
}
