import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateBundlePricing } from '../convex/lib/bundlePricing.ts';

test('bundle pricing adds every member value before applying a lot discount', () => {
  const result = aggregateBundlePricing([
    { summary: { suggestedPrice: 12.99, low: 10, high: 15, matchCount: 8 } },
    { summary: { suggestedPrice: 8.99, low: 7, high: 11, matchCount: 4 } },
    { summary: { suggestedPrice: 18.99, low: 15, high: 22, matchCount: 6 } },
  ]);
  assert.equal(result.componentValue, 40.97);
  assert.equal(result.suggestedPrice, 36.99);
  assert.equal(result.low, 28.8);
  assert.equal(result.high, 43.2);
  assert.equal(result.matchCount, 18);
  assert.equal(result.missingMembers, 0);
  assert.equal(result.confidence, 'High');
});

test('bundle pricing exposes saved fallbacks and missing member values', () => {
  const result = aggregateBundlePricing([
    { summary: { suggestedPrice: 10.99, low: 9, high: 13, matchCount: 3 } },
    { fallbackValue: 7 },
    {},
  ]);
  assert.equal(result.componentValue, 17.99);
  assert.equal(result.suggestedPrice, 16.99);
  assert.equal(result.fallbackMembers, 1);
  assert.equal(result.missingMembers, 1);
  assert.equal(result.confidence, 'Low');
});
