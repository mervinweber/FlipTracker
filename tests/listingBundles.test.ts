import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleDescription, bundleSuggestedPrice, bundleTitle, validateBundleItems } from '../src/utils/listingBundles.ts';

const books = [
  { title: 'Book One', type: 'Book', condition: 'Good', ebayPrice: 10, purchasePrice: 2 },
  { title: 'Book Two', type: 'Book', edition: 'First Edition', condition: 'Acceptable', ebayPrice: 20, purchasePrice: 3 },
];

test('compatible items produce editable eBay lot copy and a discounted suggested price', () => {
  assert.equal(validateBundleItems(books), undefined);
  assert.equal(bundleSuggestedPrice(books), 26.99);
  assert.match(bundleTitle(books), /2 Book Lot Bundle/);
  assert.match(bundleDescription(books), /2\. Book Two - First Edition \(Acceptable\)/);
});

test('bundle validation rejects incompatible categories and oversized lots', () => {
  assert.match(validateBundleItems([books[0], { title: 'Movie', type: 'DVD' }]) || '', /compatible category/);
  assert.match(validateBundleItems(Array.from({ length: 13 }, (_, index) => ({ title: `Book ${index}`, type: 'Book' }))) || '', /up to 12/);
});

