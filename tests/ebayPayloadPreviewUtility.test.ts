import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEbayPayloadPreview,
  parseEbayPayloadSpecifics,
} from '../src/utils/ebayPayloadPreview.ts';

test('parses object, JSON, and line-based item specifics safely', () => {
  assert.deepEqual(parseEbayPayloadSpecifics({ Brand: 'Nintendo', Region: ['NTSC-U/C', 'US'] }), [
    { name: 'Brand', values: ['Nintendo'] },
    { name: 'Region', values: ['NTSC-U/C', 'US'] },
  ]);

  assert.deepEqual(parseEbayPayloadSpecifics('{"Language":"English","Format":["DVD","Widescreen"]}'), [
    { name: 'Format', values: ['DVD', 'Widescreen'] },
    { name: 'Language', values: ['English'] },
  ]);

  assert.deepEqual(parseEbayPayloadSpecifics('Author: Jane Austen\nLanguage = English; Empty:'), [
    { name: 'Author', values: ['Jane Austen'] },
    { name: 'Language', values: ['English'] },
  ]);
});

test('malformed and unsupported specifics never throw', () => {
  assert.doesNotThrow(() => parseEbayPayloadSpecifics('{"Brand":'));
  assert.deepEqual(parseEbayPayloadSpecifics('{"Brand":'), []);
  assert.deepEqual(parseEbayPayloadSpecifics(null), []);
  assert.deepEqual(parseEbayPayloadSpecifics([null, 'bad', { name: 'Set', value: 'Base Set' }]), [
    { name: 'Set', values: ['Base Set'] },
  ]);
});

test('builds all preview sections and resolves common field aliases', () => {
  const preview = buildEbayPayloadPreview({
    listingTitle: 'The Example Book',
    categoryId: 261186,
    category: 'Books',
    condition: 'Very Good',
    conditionId: 4000,
    specifics: 'Author: Example Writer\nLanguage: English',
    listingDescription: 'Clean copy with light shelf wear.',
    photoUrls: ['https://example.com/front.jpg', 'https://example.com/front.jpg'],
    photos: [{ url: 'https://example.com/back.jpg' }],
    photoUrl: 'https://example.com/catalog.jpg',
    listedPrice: '14.99',
    currency: 'usd',
    packageType: 'ParcelOrPaddedEnvelope',
    weightOz: '12',
    lengthIn: 10,
    widthIn: 7,
    heightIn: 1,
    shippingPolicyId: 'fulfillment-1',
    paymentPolicyId: 'payment-1',
    returnPolicyId: 'return-1',
    merchantLocationKey: 'home-stock',
  });

  assert.equal(preview.title, 'The Example Book');
  assert.deepEqual(preview.category, { id: '261186', label: 'Books' });
  assert.deepEqual(preview.condition, { name: 'Very Good', id: '4000' });
  assert.equal(preview.specifics.length, 2);
  assert.equal(preview.description, 'Clean copy with light shelf wear.');
  assert.deepEqual(preview.photos.map((photo) => photo.label), ['Primary photo', 'Photo 2', 'Photo 3']);
  assert.equal(preview.price.formatted, '$14.99');
  assert.deepEqual(preview.package, {
    type: 'ParcelOrPaddedEnvelope',
    weight: '12 oz',
    dimensions: '10 × 7 × 1 in',
  });
  assert.deepEqual(preview.policies, {
    fulfillment: 'fulfillment-1',
    payment: 'payment-1',
    returns: 'return-1',
    inventoryLocation: 'home-stock',
  });
});

test('uses stable missing values for incomplete payloads', () => {
  const preview = buildEbayPayloadPreview({});

  assert.equal(preview.title, 'Not provided');
  assert.equal(preview.category.id, 'Not provided');
  assert.equal(preview.price.formatted, 'Not provided');
  assert.equal(preview.price.currency, 'USD');
  assert.equal(preview.package.dimensions, 'Not provided');
  assert.deepEqual(preview.photos, []);
  assert.deepEqual(preview.specifics, []);
});

