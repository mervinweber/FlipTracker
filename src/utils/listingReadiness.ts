export type ListingReadinessSeverity = 'error' | 'warning';

export type ListingReadinessStep = 'details' | 'category' | 'shipping' | 'price';

export type ListingReadinessField =
  | 'title'
  | 'price'
  | 'categoryId'
  | 'categoryAspects'
  | 'shippingPolicy'
  | 'shippingEligibility'
  | 'paymentPolicy'
  | 'returnPolicy'
  | 'inventoryLocation'
  | 'photos'
  | 'packageWeight'
  | 'packageDimensions'
  | 'bookTitle'
  | 'author'
  | 'language'
  | 'cardProductType'
  | 'cardGame'
  | 'cardSport'
  | 'cardSet'
  | 'cardNumber'
  | 'clothingType'
  | 'brand'
  | 'department'
  | 'size'
  | 'color'
  | 'material'
  | 'style';

export type ListingReadinessIssue = {
  severity: ListingReadinessSeverity;
  field: ListingReadinessField;
  step: ListingReadinessStep;
  message: string;
  blocking: boolean;
};

/**
 * The validator intentionally describes only the values it reads. Existing
 * listing models can be passed directly without depending on Convex or React.
 */
export type ListingReadinessInput = {
  title?: string | null;
  price?: number | null;
  currentPrice?: number | null;
  listedPrice?: number | null;
  ebayCategoryId?: string | number | null;
  categoryId?: string | number | null;
  fulfillmentPolicyId?: string | null;
  fulfillmentPolicyName?: string | null;
  shippingPolicyId?: string | null;
  paymentPolicyId?: string | null;
  returnPolicyId?: string | null;
  merchantLocationKey?: string | null;
  inventoryLocationKey?: string | null;
  imageMode?: string | null;
  imageUrls?: readonly string[] | null;
  photoUrls?: readonly string[] | null;
  photos?: readonly unknown[] | null;
  photoUrl?: string | null;
  ebayImageUrl?: string | null;
  catalogImageUrl?: string | null;
  hasActualPhoto?: boolean | null;
  hasCatalogIdentifier?: boolean | null;
  catalogImageEligible?: boolean | null;
  condition?: string | null;
  assetType?: string | null;
  itemType?: string | null;
  mediaFormat?: string | null;
  packageWeightOz?: number | null;
  weightOz?: number | null;
  packageLengthIn?: number | null;
  packageWidthIn?: number | null;
  packageHeightIn?: number | null;
  lengthIn?: number | null;
  widthIn?: number | null;
  heightIn?: number | null;
  bookTitle?: string | null;
  author?: string | null;
  language?: string | null;
  cardProductType?: string | null;
  cardGame?: string | null;
  cardSport?: string | null;
  cardSet?: string | null;
  cardNumber?: string | null;
  clothingType?: string | null;
  brand?: string | null;
  department?: string | null;
  size?: string | null;
  color?: string | null;
  material?: string | null;
  style?: string | null;
  itemSpecifics?: string | Readonly<Record<string, unknown>> | null;
  missingCategoryAspects?: readonly string[] | null;
};

export type SellerDefaultReadiness = {
  shippingPolicyId?: string | null;
  fulfillmentPolicyId?: string | null;
  paymentPolicyId?: string | null;
  returnPolicyId?: string | null;
  inventoryLocationKey?: string | null;
  merchantLocationKey?: string | null;
  shippingPolicyReady?: boolean;
  paymentPolicyReady?: boolean;
  returnPolicyReady?: boolean;
  inventoryLocationReady?: boolean;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function identifier(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return text(value);
}

function itemSpecificValue(
  itemSpecifics: ListingReadinessInput['itemSpecifics'],
  name: string,
): string {
  const normalizedName = name.trim().toLowerCase();

  if (typeof itemSpecifics === 'string') {
    for (const line of itemSpecifics.split('\n')) {
      const separator = line.indexOf(':');
      if (separator < 1) continue;
      if (line.slice(0, separator).trim().toLowerCase() !== normalizedName) continue;
      return line.slice(separator + 1).trim();
    }
    return '';
  }

  if (itemSpecifics && typeof itemSpecifics === 'object') {
    const matchingKey = Object.keys(itemSpecifics).find(
      (key) => key.trim().toLowerCase() === normalizedName,
    );
    if (matchingKey) {
      const value = itemSpecifics[matchingKey];
      if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
      return text(value);
    }
  }

  return '';
}

function specific(
  directValue: unknown,
  itemSpecifics: ListingReadinessInput['itemSpecifics'],
  name: string,
): string {
  return text(directValue) || itemSpecificValue(itemSpecifics, name);
}

function defaultIsReady(explicit: boolean | undefined, ...values: unknown[]): boolean {
  if (explicit !== undefined) return explicit;
  return values.some((value) => Boolean(text(value)));
}

function isBook(listing: ListingReadinessInput): boolean {
  return /\bbook\b/i.test(`${listing.assetType || ''} ${listing.itemType || ''} ${listing.mediaFormat || ''}`);
}

function isCard(listing: ListingReadinessInput): boolean {
  return /\b(card|tcg|ccg|pokemon|pokémon|yu-gi-oh|yugioh)\b/i.test(
    `${listing.assetType || ''} ${listing.itemType || ''} ${listing.mediaFormat || ''}`,
  );
}

function isSportsCard(listing: ListingReadinessInput): boolean {
  return /sports? card/i.test(`${listing.assetType || ''} ${listing.itemType || ''}`)
    || Boolean(specific(listing.cardSport, listing.itemSpecifics, 'Sport'));
}

function isClothing(listing: ListingReadinessInput): boolean {
  return /\b(clothing|clothes|apparel|shirt|blouse|pants|jeans|shorts|skirt|dress|jacket|coat|sweater|hoodie|shoe|shoes|boots?)\b/i.test(
    `${listing.assetType || ''} ${listing.itemType || ''} ${listing.mediaFormat || ''}`,
  );
}

function hasActualPhoto(listing: ListingReadinessInput): boolean {
  return listing.hasActualPhoto === true
    || Boolean(text(listing.ebayImageUrl))
    || Boolean(listing.imageUrls?.some((url) => Boolean(text(url))))
    || Boolean(listing.photoUrls?.some((url) => Boolean(text(url))))
    || Boolean(listing.photos?.length);
}

function catalogImageIsEligible(listing: ListingReadinessInput): boolean {
  if (listing.catalogImageEligible !== undefined && listing.catalogImageEligible !== null) {
    return listing.catalogImageEligible;
  }

  const condition = text(listing.condition).toLowerCase();
  const newCondition = ['new', 'brand new', 'sealed'].includes(condition);
  const catalogSourceExists = listing.hasCatalogIdentifier === true
    || Boolean(text(listing.catalogImageUrl))
    || (isBook(listing) && Boolean(text(listing.photoUrl)));
  return catalogSourceExists && (newCondition || isBook(listing));
}

function issue(
  field: ListingReadinessField,
  step: ListingReadinessStep,
  message: string,
  blocking = true,
): ListingReadinessIssue {
  return {
    severity: blocking ? 'error' : 'warning',
    field,
    step,
    message,
    blocking,
  };
}

export function validateListingReadiness(
  listing: ListingReadinessInput,
  sellerDefaults: SellerDefaultReadiness = {},
): ListingReadinessIssue[] {
  const issues: ListingReadinessIssue[] = [];
  const resolvedPrice = listing.currentPrice ?? listing.listedPrice ?? listing.price;
  const resolvedWeight = listing.packageWeightOz ?? listing.weightOz;
  const resolvedLength = listing.packageLengthIn ?? listing.lengthIn;
  const resolvedWidth = listing.packageWidthIn ?? listing.widthIn;
  const resolvedHeight = listing.packageHeightIn ?? listing.heightIn;
  const itemIdentity = `${listing.assetType || ''} ${listing.itemType || ''} ${listing.mediaFormat || ''}`.toLowerCase();
  const shippingPolicyName = text(listing.fulfillmentPolicyName).toLowerCase();

  if (!text(listing.title)) {
    issues.push(issue('title', 'details', 'Add a buyer-facing listing title.'));
  }
  if (!positive(resolvedPrice)) {
    issues.push(issue('price', 'price', 'Set a price greater than $0.'));
  }
  if (!identifier(listing.ebayCategoryId ?? listing.categoryId)) {
    issues.push(issue('categoryId', 'category', 'Choose a valid eBay leaf category.'));
  }
  if (listing.missingCategoryAspects?.length) {
    issues.push(issue('categoryAspects', 'category', `Complete required eBay fields: ${listing.missingCategoryAspects.join(', ')}.`));
  }

  const shippingReady = Boolean(text(listing.fulfillmentPolicyId) || text(listing.shippingPolicyId))
    || defaultIsReady(
      sellerDefaults.shippingPolicyReady,
      sellerDefaults.fulfillmentPolicyId,
      sellerDefaults.shippingPolicyId,
    );
  if (!shippingReady) {
    issues.push(issue('shippingPolicy', 'shipping', 'Choose a shipping policy or configure a seller default.'));
  }

  const paymentReady = Boolean(text(listing.paymentPolicyId))
    || defaultIsReady(sellerDefaults.paymentPolicyReady, sellerDefaults.paymentPolicyId);
  if (!paymentReady) {
    issues.push(issue('paymentPolicy', 'shipping', 'Configure an eBay payment policy.'));
  }

  const returnReady = Boolean(text(listing.returnPolicyId))
    || defaultIsReady(sellerDefaults.returnPolicyReady, sellerDefaults.returnPolicyId);
  if (!returnReady) {
    issues.push(issue('returnPolicy', 'shipping', 'Configure an eBay return policy.'));
  }

  const locationReady = Boolean(text(listing.inventoryLocationKey) || text(listing.merchantLocationKey))
    || defaultIsReady(
      sellerDefaults.inventoryLocationReady,
      sellerDefaults.inventoryLocationKey,
      sellerDefaults.merchantLocationKey,
    );
  if (!locationReady) {
    issues.push(issue('inventoryLocation', 'shipping', 'Choose an eBay inventory location.'));
  }

  const catalogMode = /catalog/i.test(text(listing.imageMode));
  if (catalogMode ? !catalogImageIsEligible(listing) : !hasActualPhoto(listing)) {
    issues.push(issue(
      'photos',
      'shipping',
      catalogMode
        ? 'The selected catalog-image mode is not eligible for this item; add an actual photo or a qualifying catalog identifier.'
        : 'Add at least one actual item photo.',
    ));
  }

  if (!positive(resolvedWeight)) {
    issues.push(issue('packageWeight', 'shipping', 'Enter a package weight greater than 0 oz.'));
  }
  if (![resolvedLength, resolvedWidth, resolvedHeight].every(positive)) {
    issues.push(issue('packageDimensions', 'shipping', 'Enter positive package length, width, and height.'));
  }
  if (shippingPolicyName.includes('media mail') && /video game|videogame|game/.test(itemIdentity)) {
    issues.push(issue('shippingEligibility', 'shipping', 'Video games are not eligible for USPS Media Mail. Choose a parcel shipping policy.'));
  }
  if (shippingPolicyName.includes('standard envelope')) {
    const exceedsWeight = positive(resolvedWeight) && resolvedWeight > 3;
    const exceedsDimensions = positive(resolvedLength) && positive(resolvedWidth) && positive(resolvedHeight)
      && (resolvedLength > 11.5 || resolvedWidth > 6.125 || resolvedHeight > 0.25);
    if (exceedsWeight || exceedsDimensions) {
      issues.push(issue('shippingEligibility', 'shipping', 'eBay Standard Envelope is limited to 3 oz and 11.5 × 6.125 × 0.25 inches. Choose another policy or correct the package.'));
    }
  }

  if (isBook(listing)) {
    if (!specific(listing.bookTitle, listing.itemSpecifics, 'Book Title')) {
      issues.push(issue('bookTitle', 'category', 'Add the required Book Title item specific.'));
    }
    if (!specific(listing.author, listing.itemSpecifics, 'Author')) {
      issues.push(issue('author', 'category', 'Add the required Author item specific.'));
    }
    if (!specific(listing.language, listing.itemSpecifics, 'Language')) {
      issues.push(issue('language', 'category', 'Choose the book language.'));
    }
  }

  if (isCard(listing)) {
    const productType = specific(listing.cardProductType, listing.itemSpecifics, 'Type');
    if (!productType) {
      issues.push(issue('cardProductType', 'category', 'Choose the card sale format or product type.'));
    }

    if (isSportsCard(listing)) {
      if (!specific(listing.cardSport, listing.itemSpecifics, 'Sport')) {
        issues.push(issue('cardSport', 'category', 'Choose the sport for this card listing.'));
      }
    } else if (!specific(listing.cardGame, listing.itemSpecifics, 'Game')) {
      issues.push(issue('cardGame', 'category', 'Choose the trading card game.'));
    }

    if (/single card/i.test(productType)) {
      if (!specific(listing.cardSet, listing.itemSpecifics, 'Set')) {
        issues.push(issue('cardSet', 'category', 'Add the card set when known.', false));
      }
      if (!specific(listing.cardNumber, listing.itemSpecifics, 'Card Number')) {
        issues.push(issue('cardNumber', 'category', 'Add the card number when known.', false));
      }
    }
  }

  if (isClothing(listing)) {
    const clothingFields: Array<{
      field: ListingReadinessField;
      directValue: unknown;
      specificName: string;
      message: string;
      blocking?: boolean;
    }> = [
      { field: 'clothingType', directValue: listing.clothingType, specificName: 'Type', message: 'Choose the garment or clothing type.' },
      { field: 'brand', directValue: listing.brand, specificName: 'Brand', message: 'Add the clothing brand.' },
      { field: 'department', directValue: listing.department, specificName: 'Department', message: 'Choose the clothing department.' },
      { field: 'size', directValue: listing.size, specificName: 'Size', message: 'Add the clothing size.' },
      { field: 'color', directValue: listing.color, specificName: 'Color', message: 'Add the primary clothing color.' },
      { field: 'material', directValue: listing.material, specificName: 'Material', message: 'Add the material when known.', blocking: false },
      { field: 'style', directValue: listing.style, specificName: 'Style', message: 'Add the style when known.', blocking: false },
    ];

    for (const clothingField of clothingFields) {
      if (!specific(clothingField.directValue, listing.itemSpecifics, clothingField.specificName)) {
        issues.push(issue(
          clothingField.field,
          'category',
          clothingField.message,
          clothingField.blocking ?? true,
        ));
      }
    }
  }

  return issues;
}

export function isListingReady(
  listing: ListingReadinessInput,
  sellerDefaults: SellerDefaultReadiness = {},
): boolean {
  return !validateListingReadiness(listing, sellerDefaults).some((readinessIssue) => readinessIssue.blocking);
}
