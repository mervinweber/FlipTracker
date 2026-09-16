import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeBundleFoundation, summarizeBundleTitles } from '../src/utils/bundleFoundation.ts';

test('bundle foundation summarizes titles without dumping every member into the row', () => {
  assert.equal(
    summarizeBundleTitles(['Batman Vol. 1', 'Batman Vol. 2', 'Batman Vol. 3', 'Batman Vol. 4']),
    'Batman Vol. 1 | Batman Vol. 2 | Batman Vol. 3 | +1 more',
  );
});

test('bundle foundation flags missing costs, missing photos, and unset price', () => {
  const summary = summarizeBundleFoundation({
    title: 'Batman Lot of 2 Books',
    bundleCount: 2,
    actualPhotoCount: 0,
    bundleMembers: [
      { title: 'Batman Vol. 1', purchasePrice: 2 },
      { title: 'Batman Vol. 2' },
    ],
  });

  assert.equal(summary.isBundle, true);
  assert.equal(summary.costTotal, 2);
  assert.equal(summary.missingCostCount, 1);
  assert.deepEqual(summary.issues, ['1 member cost missing', 'No actual photos attached', 'Bundle price not set']);
});
