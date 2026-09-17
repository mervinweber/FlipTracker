import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDepopCsv, crossListFamily, defaultCrossListCategory, normalizeCrossListCondition } from '../src/utils/crossListHandoff.ts';

test('cross-list category defaults focus Mercari and Depop by item family', () => {
  assert.equal(crossListFamily('Book', 'Graphic Novel'), 'book');
  assert.equal(crossListFamily('DVD', 'DVD'), 'media');
  assert.equal(crossListFamily('Pokemon Card'), 'card');
  assert.equal(defaultCrossListCategory('Mercari', 'Book', 'Paperback'), 'Books');
  assert.equal(defaultCrossListCategory('Mercari', 'DVD', 'DVD'), 'Electronics > Movies & TV');
  assert.equal(defaultCrossListCategory('Depop', 'Video Game', 'PS4'), 'Video Games');
});

test('condition mapping uses marketplace-friendly wording', () => {
  assert.equal(normalizeCrossListCondition('New with tags', 'Clothing'), 'New with tags');
  assert.equal(normalizeCrossListCondition('Very Good', 'DVD'), 'Like New');
  assert.equal(normalizeCrossListCondition('Acceptable', 'Book'), 'Acceptable');
  assert.equal(normalizeCrossListCondition('Good', 'Book'), 'Good');
});

test('Depop CSV includes public photos, identifiers, and SKU', () => {
  const csv = buildDepopCsv([{
    title: 'Batman Lot',
    description: 'Two Batman graphic novels.',
    type: 'Book',
    price: 22,
    sku: 'FT-123',
    barcode: '9781401235420',
    photoUrls: ['https://example.com/front.jpg', 'data:image/jpeg;base64,nope'],
    platformCategory: 'Books & Media',
  }]);
  assert.match(csv, /Template version: 6/);
  assert.match(csv, /Two Batman graphic novels\.\n\nIdentifier: 9781401235420/);
  assert.match(csv, /https:\/\/example.com\/front\.jpg/);
  assert.doesNotMatch(csv, /data:image/);
  assert.match(csv, /FT-123/);
});
