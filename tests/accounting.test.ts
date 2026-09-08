import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateYearAccounting } from '../src/utils/accounting.ts';

test('year accounting subtracts sold costs and inventory write-offs from profit', () => {
  const totals = calculateYearAccounting([
    { soldDate: '2025-03-01', soldPrice: 100, shippingCharged: 5, purchasePrice: 20, fees: 15, shipping: 8 },
    { soldDate: '2025-11-20', soldPrice: 25, purchasePrice: 5, fees: 3.75, shipping: 4.25 },
    { soldDate: '2026-01-02', soldPrice: 999, purchasePrice: 1 },
  ], [
    { effectiveDate: '2025-12-15', amount: 12.5 },
    { effectiveDate: '2026-01-05', amount: 30 },
  ], 2025);

  assert.deepEqual(totals, {
    year: 2025,
    saleCount: 2,
    writeOffCount: 1,
    revenue: 125,
    shippingIncome: 5,
    itemCost: 25,
    fees: 18.75,
    shippingCost: 12.25,
    salesProfit: 74,
    writeOffCost: 12.5,
    netProfit: 61.5,
  });
});

test('undated sales are excluded from a year closeout', () => {
  const totals = calculateYearAccounting([{ soldPrice: 50, purchasePrice: 10 }], [], 2025);
  assert.equal(totals.saleCount, 0);
  assert.equal(totals.netProfit, 0);
});

