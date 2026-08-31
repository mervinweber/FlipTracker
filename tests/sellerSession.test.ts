import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createSellerSession,
  formatSellerSessionDuration,
  loadSellerSession,
  pauseSellerSession,
  recordSellerSessionEvent,
  resumeSellerSession,
  saveSellerSession,
  sellerSessionElapsedMs,
} from '../src/utils/sellerSession.ts';

function memoryStorage(seed: string | null = null) {
  let value = seed;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    removeItem: () => { value = null; },
  };
}

describe('seller session', () => {
  it('tracks active and paused elapsed time', () => {
    const started = createSellerSession(1_000);
    assert.equal(sellerSessionElapsedMs(started, 6_000), 5_000);
    const paused = pauseSellerSession(started, 6_000);
    assert.equal(sellerSessionElapsedMs(paused, 20_000), 5_000);
    assert.equal(sellerSessionElapsedMs(resumeSellerSession(paused, 20_000), 22_000), 7_000);
  });

  it('counts completed workflow events independently', () => {
    const session = recordSellerSessionEvent(recordSellerSessionEvent(createSellerSession(0), 'reviewed'), 'staged');
    assert.equal(session.reviewed, 1);
    assert.equal(session.staged, 1);
    assert.equal(session.published, 0);
  });

  it('persists valid sessions and rejects malformed data', () => {
    const storage = memoryStorage();
    const session = pauseSellerSession(createSellerSession(10), 110);
    saveSellerSession(session, storage);
    assert.deepEqual(loadSellerSession(storage), session);
    assert.equal(loadSellerSession(memoryStorage('{bad json')), null);
  });

  it('formats compact session durations', () => {
    assert.equal(formatSellerSessionDuration(65_000), '1:05');
    assert.equal(formatSellerSessionDuration(3_665_000), '1:01:05');
  });
});
