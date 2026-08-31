import assert from 'node:assert/strict';
import test from 'node:test';
import { fulfillmentEconomics, recommendFulfillment } from '../src/utils/fulfillment.ts';

test('recommends Media Mail for eligible books and discs', () => {
  assert.equal(recommendFulfillment({ assetType: 'Book', soldPrice: 12 }).service, 'USPS Media Mail');
  assert.equal(recommendFulfillment({ assetType: 'DVD', soldPrice: 15 }).service, 'USPS Media Mail');
});

test('keeps video games out of Media Mail', () => {
  const result = recommendFulfillment({ assetType: 'Video Game', soldPrice: 25 });
  assert.equal(result.service, 'USPS Ground Advantage');
  assert.match(result.warnings.join(' '), /not eligible/i);
});

test('only suggests standard envelope for eligible low-value cards', () => {
  assert.equal(recommendFulfillment({ assetType: 'Pokemon Card', soldPrice: 18, packageWeightOz: 2 }).service, 'eBay Standard Envelope');
  assert.equal(recommendFulfillment({ assetType: 'Pokemon Card', soldPrice: 45, packageWeightOz: 2 }).service, 'USPS Ground Advantage');
});

test('suggests UPS comparison for bulky packages', () => {
  const result = recommendFulfillment({ assetType: 'General Merchandise', packageWeightOz: 64, packageLengthIn: 18, packageWidthIn: 14, packageHeightIn: 10 });
  assert.equal(result.carrier, 'UPS');
  assert.equal(result.service, 'UPS Ground');
});

test('calculates shipping margin and estimated net', () => {
  assert.deepEqual(fulfillmentEconomics({ soldPrice: 40, shippingCharged: 6, shippingCost: 5, fees: 6, purchasePrice: 10 }), {
    shippingMargin: 1,
    estimatedNet: 25,
  });
});
