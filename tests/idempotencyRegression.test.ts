import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isListingReady,
  validateListingReadiness,
  type ListingReadinessInput,
  type SellerDefaultReadiness,
} from '../src/utils/listingReadiness.ts';
import {
  findSuggestedShippingPolicy,
  resolveEbayCategory,
  resolveShippingProfile,
} from '../src/config/ebayListingDefaults.ts';

const defaults: SellerDefaultReadiness = {
  fulfillmentPolicyId: 'fulfillment-1',
  paymentPolicyId: 'payment-1',
  returnPolicyId: 'return-1',
  merchantLocationKey: 'home',
};

function bookListing(overrides: Partial<ListingReadinessInput> = {}): ListingReadinessInput {
  return {
    title: 'A Man Called Ove',
    currentPrice: 10.99,
    ebayCategoryId: '261186',
    assetType: 'Book',
    imageMode: 'Catalog Image',
    hasCatalogIdentifier: true,
    condition: 'Good',
    packageWeightOz: 16,
    packageLengthIn: 10,
    packageWidthIn: 8,
    packageHeightIn: 2,
    itemSpecifics: {
      'Book Title': 'A Man Called Ove',
      Author: 'Fredrik Backman',
      Language: 'English',
    },
    ...overrides,
  };
}

test('readiness validation is deterministic and does not mutate listing data', () => {
  const listing = bookListing();
  const listingSnapshot = structuredClone(listing);
  const defaultsSnapshot = structuredClone(defaults);

  const first = validateListingReadiness(listing, defaults);
  const second = validateListingReadiness(listing, defaults);

  assert.deepEqual(second, first);
  assert.deepEqual(listing, listingSnapshot);
  assert.deepEqual(defaults, defaultsSnapshot);
  assert.equal(isListingReady(listing, defaults), true);
});

test('reapplying the same category resolution returns the same complete decision', () => {
  const input = {
    itemType: 'Yu-Gi-Oh! Card',
    barcode: '123456789012',
    cardSaleFormat: 'sealed pack',
  } as const;

  const first = resolveEbayCategory(input);
  const second = resolveEbayCategory(input);

  assert.deepEqual(second, first);
  assert.equal(first.categoryId, '183456');
  assert.equal(first.source, 'item-type');
});

test('reapplying shipping selection produces a stable policy choice', () => {
  const policies = [
    { id: 'ground', name: 'USPS Ground Advantage' },
    { id: 'media', name: 'USPS Media Mail - Single Book' },
  ];
  const profile = resolveShippingProfile({ itemType: 'Book', title: 'Paperback novel' });

  const first = findSuggestedShippingPolicy(policies, profile);
  const second = findSuggestedShippingPolicy(policies, profile);

  assert.strictEqual(second, first);
  assert.equal(first?.id, 'media');
  assert.deepEqual(policies, [
    { id: 'ground', name: 'USPS Ground Advantage' },
    { id: 'media', name: 'USPS Media Mail - Single Book' },
  ]);
});

test('correcting a blocked listing clears only the corrected lifecycle issues', () => {
  const incomplete = bookListing({
    currentPrice: 0,
    itemSpecifics: { 'Book Title': 'A Man Called Ove' },
  });
  const before = validateListingReadiness(incomplete, defaults);
  assert.deepEqual(
    before.filter((entry) => entry.blocking).map((entry) => entry.field),
    ['price', 'author', 'language'],
  );

  const corrected: ListingReadinessInput = {
    ...incomplete,
    currentPrice: 10.99,
    itemSpecifics: {
      'Book Title': 'A Man Called Ove',
      Author: 'Fredrik Backman',
      Language: 'English',
    },
  };

  assert.equal(isListingReady(corrected, defaults), true);
  assert.deepEqual(validateListingReadiness(corrected, defaults), []);
});
