import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateAnalysis } from '../convex/lib/sourcingRules.ts';

const input = {
  title: 'Example item',
  purchaseCost: 5,
  shippingCost: 4,
  packagingCost: 1,
  feePercent: 15,
  activeCount: 10,
  soldCount90: 20,
  soldPrices: [25, 26, 27, 28, 29, 30, 31, 32].map((price) => ({ price })),
};

describe('profit-first sourcing rules', () => {
  it('calculates a maximum buy price that satisfies profit and ROI targets', () => {
    const result = calculateAnalysis({ ...input, targetProfit: 10, targetRoiPercent: 50, minimumLiquidity: 40 });
    assert.equal(result.maximumBuyPrice, 9.23);
    assert.equal(result.recommendation, 'Buy');
  });

  it('lets stricter seller rules change the recommendation without changing comp math', () => {
    const ordinary = calculateAnalysis({ ...input, targetProfit: 10, targetRoiPercent: 50, minimumLiquidity: 40 });
    const strict = calculateAnalysis({ ...input, targetProfit: 25, targetRoiPercent: 200, minimumLiquidity: 90 });
    assert.equal(ordinary.medianSold, strict.medianSold);
    assert.notEqual(strict.recommendation, 'Buy');
    assert.equal(strict.maximumBuyPrice, 0);
  });
});
