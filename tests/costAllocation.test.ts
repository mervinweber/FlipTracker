import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateLotTotal } from '../convex/lib/costAllocation.ts';

test('allocates a batch total exactly to the cent', () => {
  const costs = allocateLotTotal(10, 3);
  assert.deepEqual(costs, [3.34, 3.33, 3.33]);
  assert.equal(costs.reduce((sum, cost) => sum + Math.round(cost * 100), 0), 1000);
});

test('supports free lots and empty batches', () => {
  assert.deepEqual(allocateLotTotal(0, 3), [0, 0, 0]);
  assert.deepEqual(allocateLotTotal(25, 0), []);
});

test('rejects invalid allocation inputs', () => {
  assert.throws(() => allocateLotTotal(-1, 2));
  assert.throws(() => allocateLotTotal(10, 1.5));
});
