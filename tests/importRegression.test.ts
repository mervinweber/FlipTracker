import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isIsbnBarcode,
  resolveEbayCategory,
  resolveShippingProfile,
} from '../src/config/ebayListingDefaults.ts';
import {
  effectiveAverage,
  effectiveHigh,
  effectiveLow,
  profit,
  type InventoryItem,
} from '../src/types/inventory.ts';

function importedItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    type: 'Book',
    title: 'Imported book',
    createdAt: '2026-08-19T12:00:00.000Z',
    updatedAt: '2026-08-19T12:00:00.000Z',
    ...overrides,
  };
}

test('formatted ISBN-10 and ISBN-13 values survive import normalization', () => {
  assert.equal(isIsbnBarcode('0-306-40615-2'), true);
  assert.equal(isIsbnBarcode('978-0-306-40615-7'), true);

  const resolution = resolveEbayCategory({ barcode: '978 0 306 40615 7' });
  assert.equal(resolution.choice.key, 'book');
  assert.equal(resolution.categoryId, '261186');
  assert.equal(resolution.source, 'isbn');
  assert.equal(resolution.isAutomatic, true);
});

test('a numeric product barcode is not mistaken for an ISBN when its checksum is invalid', () => {
  const resolution = resolveEbayCategory({ barcode: '9780306406158' });

  assert.equal(resolution.choice.key, 'general-merchandise');
  assert.equal(resolution.source, 'barcode-fallback');
  assert.equal(resolution.categoryId, undefined);
  assert.equal(resolution.requiresLeafSelection, true);
});

test('an explicit imported item type takes precedence over barcode inference', () => {
  const resolution = resolveEbayCategory({
    itemType: 'DVD',
    barcode: '9780306406157',
    barcodeType: 'ISBN-13',
  });

  assert.equal(resolution.choice.key, 'dvd');
  assert.equal(resolution.categoryId, '617');
  assert.equal(resolution.source, 'item-type');
});

test('imported card sale formats resolve to the corresponding leaf category', () => {
  assert.equal(
    resolveEbayCategory({ itemType: 'Pokemon Card', cardSaleFormat: 'sealed box' }).categoryId,
    '261044',
  );
  assert.equal(
    resolveEbayCategory({ itemType: 'Sports Card', cardSaleFormat: 'lot' }).categoryId,
    '261329',
  );
});

test('imported value overrides and completed-sale costs retain their accounting meaning', () => {
  const item = importedItem({
    estLow: 10,
    estHigh: 20,
    userLow: 30,
    userHigh: 40,
    valueSource: 'User Override',
    soldPrice: 50,
    purchasePrice: 12,
    fees: 7.5,
    shipping: 5,
  });

  assert.equal(effectiveLow(item), 30);
  assert.equal(effectiveHigh(item), 40);
  assert.equal(effectiveAverage(item), 35);
  assert.equal(profit(item), 25.5);
});

test('shipping defaults classify common imported titles without changing the input', () => {
  const input = { itemType: 'Book', mediaFormat: 'Paperback', title: 'Three-book collection' };
  const snapshot = structuredClone(input);

  const profile = resolveShippingProfile(input);

  assert.equal(profile.key, 'multi-media');
  assert.deepEqual(input, snapshot);
});
