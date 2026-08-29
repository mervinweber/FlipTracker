import assert from 'node:assert/strict';
import test from 'node:test';
import { splitPhotoLotTotal } from '../src/utils/photoLot.ts';

test('splits a lot total exactly to the cent', () => {
  const values = splitPhotoLotTotal('10.00', 3);
  assert.deepEqual(values, ['3.34', '3.33', '3.33']);
  assert.equal(values.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0), 1000);
});

test('returns blank costs when no purchase total was entered', () => {
  assert.deepEqual(splitPhotoLotTotal('', 3), ['', '', '']);
});

test('does not create allocations for an empty lot', () => {
  assert.deepEqual(splitPhotoLotTotal('25.00', 0), []);
});
