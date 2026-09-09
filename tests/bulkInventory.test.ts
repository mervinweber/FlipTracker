import assert from 'node:assert/strict';
import test from 'node:test';
import { appendUniqueDisclosure, updateListingDescription } from '../convex/lib/bulkInventory.ts';

test('bulk disclosures append without replacing existing item notes', () => {
  assert.equal(appendUniqueDisclosure('Writing on title page.', 'Library copy.'), 'Writing on title page.\nLibrary copy.');
  assert.equal(appendUniqueDisclosure('Library copy.', 'library copy.'), 'Library copy.');
  assert.equal(appendUniqueDisclosure('Writing on title page.\nLibrary copy with stamps.', 'Library copy.'), 'Writing on title page.\nLibrary copy with stamps.');
});

test('bulk details update generated listing copy without duplicate disclosure text', () => {
  const updated = updateListingDescription({
    description: 'Example Book\nCondition: Good',
    title: 'Example Book',
    condition: 'Acceptable',
    disclosure: 'Library copy.',
  });
  assert.equal(updated, 'Example Book\nCondition: Acceptable\nItem details: Library copy.');
  assert.equal(updateListingDescription({ description: updated, title: 'Example Book', disclosure: 'Library copy.' }), updated);
});

test('bundle member disclosures identify the affected title', () => {
  assert.match(updateListingDescription({
    description: 'Bundle lot of 3 books.',
    title: 'Example Book',
    disclosure: 'Library copy.',
    bundleMember: true,
  }), /Item details for Example Book: Library copy\./);
});
