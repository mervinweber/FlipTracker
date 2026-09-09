import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleDescription, bundleSuggestedPrice, bundleTitle, validateBundleItems } from '../src/utils/listingBundles.ts';

const books = [
  { title: 'Batman Volume 1 Court of Owls', type: 'Book', mediaFormat: 'Paperback', author: 'Scott Snyder', condition: 'Good', upc: '9781401235420', barcodeType: 'ISBN-13', ebayPrice: 10, purchasePrice: 2 },
  { title: 'Batman Volume 10 Epilogue', type: 'Book', mediaFormat: 'Paperback', author: 'Scott Snyder', edition: 'First Edition', condition: 'Acceptable', barcode: '9781401253356', ebayPrice: 20, purchasePrice: 3 },
];

test('compatible items produce editable eBay lot copy and a discounted suggested price', () => {
  assert.equal(validateBundleItems(books), undefined);
  assert.equal(bundleSuggestedPrice(books), 26.99);
  assert.equal(bundleTitle(books), 'Batman Lot of 2 Books Paperback Mixed Titles');
  assert.match(bundleDescription(books), /1\. Batman Volume 1 Court of Owls\n   Author: Scott Snyder \| Format: Paperback \| ISBN: 9781401235420 \| Condition: Good/);
  assert.match(bundleDescription(books), /2\. Batman Volume 10 Epilogue\n   Author: Scott Snyder \| Format: Paperback \| Edition: First Edition \| ISBN: 9781401253356 \| Condition: Acceptable/);
});

test('mixed movie bundle titles summarize the lot instead of concatenating item descriptions', () => {
  const movies = [
    { title: 'A Very Long Movie Title That Should Never Be Piled Into Another Full Title', type: 'DVD', mediaFormat: 'DVD', upc: '012345678905' },
    { title: 'Completely Different Film With Its Own Extremely Long Subtitle', type: 'DVD', mediaFormat: 'DVD', upc: '012345678912' },
  ];
  assert.equal(bundleTitle(movies), 'Lot of 2 DVD Movies Mixed Titles');
  assert.ok(bundleTitle(movies).length <= 80);
  assert.match(bundleDescription(movies), /UPC: 012345678905/);
});

test('bundle validation rejects incompatible categories and oversized lots', () => {
  assert.match(validateBundleItems([books[0], { title: 'Movie', type: 'DVD' }]) || '', /compatible category/);
  assert.match(validateBundleItems(Array.from({ length: 13 }, (_, index) => ({ title: `Book ${index}`, type: 'Book' }))) || '', /up to 12/);
});
