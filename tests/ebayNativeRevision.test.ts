import assert from 'node:assert/strict';
import test from 'node:test';
import {
  conditionIdForNativeListing,
  itemSpecificsXml,
  mergeItemSpecifics,
  remoteItemSpecifics,
} from '../convex/lib/ebayNativeRevision.ts';

test('native eBay revisions preserve remote specifics and replace local corrections case-insensitively', () => {
  const remote = remoteItemSpecifics({
    NameValueList: [
      { Name: 'Brand', Value: 'Nintendo' },
      { Name: 'Language', Value: ['English', 'French'] },
      { Name: { '#text': 'Region Code' }, Value: { '#text': 'NTSC-U/C' } },
    ],
  });

  const merged = mergeItemSpecifics(remote, {
    language: ['English'],
    Condition: ['Very Good'],
  });

  assert.deepEqual(merged, {
    Brand: ['Nintendo'],
    'Region Code': ['NTSC-U/C'],
    language: ['English'],
    Condition: ['Very Good'],
  });
});

test('native eBay specifics XML escapes seller text and retains multiple values', () => {
  const xml = itemSpecificsXml({
    Author: ['A & B'],
    Language: ['English', 'French'],
    Empty: [''],
  });

  assert.match(xml, /<Name>Author<\/Name><Value>A &amp; B<\/Value>/);
  assert.match(xml, /<Name>Language<\/Name><Value>English<\/Value><Value>French<\/Value>/);
  assert.doesNotMatch(xml, /Empty/);
});

test('native eBay condition mapping uses known IDs and preserves an unknown remote condition', () => {
  assert.equal(conditionIdForNativeListing('Brand New'), '1000');
  assert.equal(conditionIdForNativeListing('New with tags'), '1000');
  assert.equal(conditionIdForNativeListing('New without tags'), '1500');
  assert.equal(conditionIdForNativeListing('New with defects'), '1750');
  assert.equal(conditionIdForNativeListing('Pre-owned - Excellent'), '2990');
  assert.equal(conditionIdForNativeListing('Pre-owned - Good'), '3000');
  assert.equal(conditionIdForNativeListing('Pre-owned - Fair'), '3010');
  assert.equal(conditionIdForNativeListing('Very Good'), '4000');
  assert.equal(conditionIdForNativeListing('For Parts'), '7000');
  assert.equal(conditionIdForNativeListing(undefined, { '#text': 3000 }), '3000');
});
