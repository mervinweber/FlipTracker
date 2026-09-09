import assert from 'node:assert/strict';
import test from 'node:test';
import { priorityFromValue, recommendationFromAsset } from '../src/utils/inventoryRecommendations.ts';

test('low-value standalone media is reviewed instead of automatically bundled', () => {
  assert.equal(recommendationFromAsset({ type: 'DVD', estimatedHigh: 8, condition: 'Good' }), 'Review');
  assert.equal(recommendationFromAsset({ type: 'Blu-ray', estimatedHigh: 4, condition: 'Good' }), 'Review');
  assert.equal(priorityFromValue({ type: 'DVD', estimatedHigh: 8 }), 'Review');
});

test('valuable or incomplete items still receive decisive recommendations', () => {
  assert.equal(recommendationFromAsset({ type: 'DVD', estimatedHigh: 18, condition: 'Good' }), 'Sell Individually');
  assert.equal(recommendationFromAsset({ type: 'DVD', estimatedHigh: 18, completeness: 'Case Only' }), 'Skip');
});
