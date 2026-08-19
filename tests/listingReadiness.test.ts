import assert from 'node:assert/strict';
import test from 'node:test';
import { isListingReady, validateListingReadiness, type ListingReadinessInput } from '../src/utils/listingReadiness.ts';

const sellerDefaults = {
  fulfillmentPolicyId: 'shipping-policy',
  paymentPolicyId: 'payment-policy',
  returnPolicyId: 'return-policy',
  merchantLocationKey: 'warehouse',
};

function readyListing(overrides: Partial<ListingReadinessInput> = {}): ListingReadinessInput {
  return {
    title: 'Example DVD',
    currentPrice: 14.99,
    ebayCategoryId: '617',
    assetType: 'DVD',
    imageMode: 'Actual Item Photo',
    hasActualPhoto: true,
    packageWeightOz: 8,
    packageLengthIn: 10,
    packageWidthIn: 7,
    packageHeightIn: 1,
    ...overrides,
  };
}

test('a complete media listing is ready', () => {
  assert.equal(isListingReady(readyListing(), sellerDefaults), true);
});

test('books require title, author, and language specifics', () => {
  const issues = validateListingReadiness(readyListing({ assetType: 'Book', ebayCategoryId: '261186' }), sellerDefaults);
  assert.deepEqual(
    issues.filter((issue) => issue.blocking).map((issue) => issue.field),
    ['bookTitle', 'author', 'language'],
  );
});

test('a metadata cover does not satisfy actual-photo mode', () => {
  const issues = validateListingReadiness(readyListing({ hasActualPhoto: false, photoUrl: 'https://example.com/cover.jpg' }), sellerDefaults);
  assert.equal(issues.some((issue) => issue.field === 'photos' && issue.blocking), true);
});

test('games cannot use a Media Mail policy', () => {
  const issues = validateListingReadiness(readyListing({ assetType: 'Video Game', fulfillmentPolicyName: 'USPS Media Mail' }), sellerDefaults);
  assert.equal(issues.some((issue) => issue.field === 'shippingEligibility' && issue.blocking), true);
});

test('Standard Envelope rejects packages above its limits', () => {
  const issues = validateListingReadiness(readyListing({
    assetType: 'Pokemon Card',
    fulfillmentPolicyName: 'eBay Standard Envelope',
    packageWeightOz: 4,
    cardProductType: 'Single Card',
    cardGame: 'Pokemon TCG',
  }), sellerDefaults);
  assert.equal(issues.some((issue) => issue.field === 'shippingEligibility' && issue.blocking), true);
});

test('clothing requires its core item specifics', () => {
  const issues = validateListingReadiness(readyListing({ assetType: 'Clothing', ebayCategoryId: '57989' }), sellerDefaults);
  const fields = issues.filter((issue) => issue.blocking).map((issue) => issue.field);
  assert.deepEqual(fields, ['clothingType', 'brand', 'department', 'size', 'color']);
});
