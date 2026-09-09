import assert from 'node:assert/strict';
import test from 'node:test';
import { completeBookTitle, mergeBookMetadata, primaryAuthorsFromResponsibility, selectGoogleBookCandidate } from '../convex/lib/bookMetadata.ts';

test('book titles retain useful subtitles but discard catalog responsibility statements', () => {
  assert.equal(completeBookTitle('Batman Vol. 1', 'The Court of Owls'), 'Batman Vol. 1: The Court of Owls');
  assert.equal(completeBookTitle('Batman: Haunted Knight', '/ Jeph Loeb & Tim Sale'), 'Batman: Haunted Knight');
  assert.equal(
    completeBookTitle('Batman haunted knight : the legends of the Dark Knight Halloween specials : three tales of Halloween in Gotham City'),
    'Batman Haunted Knight',
  );
  assert.deepEqual(
    primaryAuthorsFromResponsibility('/ Jeph Loeb & Tim Sale, storytellers ; Gregory Wright, colorist.'),
    ['Jeph Loeb', 'Tim Sale'],
  );
});

test('richer exact-ISBN metadata wins over generic or overlong catalog titles', () => {
  const generic = { title: 'Batman', source: 'Open Library', confidence: 'High', coverImageUrl: 'https://example.com/cover.jpg' };
  const rich = { title: 'Batman Vol. 5: Zero Year - Dark City (The New 52)', source: 'Google Books', confidence: 'High', author: 'Scott Snyder' };
  const merged = mergeBookMetadata(generic, rich);
  assert.equal(merged?.title, rich.title);
  assert.equal(merged?.author, rich.author);
  assert.equal(merged?.coverImageUrl, generic.coverImageUrl);
  assert.equal(merged?.source, 'Open Library + Google Books');

  const catalog = { title: 'Batman haunted knight: the legends of the Dark Knight Halloween specials: three tales of Halloween in Gotham City', source: 'Open Library', confidence: 'High' };
  const concise = { title: 'Batman: Haunted Knight', source: 'Google Books', confidence: 'High' };
  assert.equal(mergeBookMetadata(catalog, concise)?.title, 'Batman: Haunted Knight');
});

test('Google Books selection prefers an exact ISBN over an earlier identifier-less candidate', () => {
  const missingIdentifier = { id: 'generic', volumeInfo: {} };
  const wrongIdentifier = { id: 'wrong', volumeInfo: { industryIdentifiers: [{ identifier: '9780000000002' }] } };
  const exact = { id: 'exact', volumeInfo: { industryIdentifiers: [{ identifier: '978-1-4012-3542-0' }] } };
  const selected = selectGoogleBookCandidate([missingIdentifier, wrongIdentifier, exact], ['9781401235420']);
  assert.equal(selected?.candidate.id, 'exact');
  assert.equal(selected?.exactIdentifierMatch, true);
});

test('Google Books selection rejects mismatched ISBNs and flags identifier-less fallback', () => {
  const wrong = { id: 'wrong', volumeInfo: { industryIdentifiers: [{ identifier: '9780000000002' }] } };
  const fallback = { id: 'fallback', volumeInfo: {} };
  assert.equal(selectGoogleBookCandidate([wrong], ['9781401235420']), null);
  assert.deepEqual(selectGoogleBookCandidate([wrong, fallback], ['9781401235420']), {
    candidate: fallback,
    exactIdentifierMatch: false,
  });
});
