import assert from 'node:assert/strict';
import test from 'node:test';
import { median, removePriceOutliers } from '../convex/lib/pricingStats.ts';

test('pricing stats calculate a stable median', () => {
  assert.equal(median([13, 10, 12, 11]), 11.5);
  assert.equal(median([999, 12, 10]), 12);
  assert.equal(median([]), 0);
});

test('pricing stats remove extreme active-listing outliers', () => {
  const rows = [10, 11, 12, 13, 999].map((price) => ({ price }));
  assert.deepEqual(removePriceOutliers(rows, (row) => row.price).map((row) => row.price), [10, 11, 12, 13]);
});

test('pricing stats retain small samples instead of overstating confidence', () => {
  const rows = [5, 100, 500].map((price) => ({ price }));
  assert.equal(removePriceOutliers(rows, (row) => row.price).length, 3);
});
