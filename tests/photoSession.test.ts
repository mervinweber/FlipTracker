import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { completePhotoTarget, createPhotoSession, formatPhotoSessionDuration, loadPhotoSession, pausePhotoSession, photoSessionElapsedMs, recordPhotoUpload, resumePhotoSession, savePhotoSession, skipPhotoTarget } from '../src/utils/photoSession.ts';

function memoryStorage() {
  let value: string | null = null;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; }, removeItem: () => { value = null; } };
}

describe('photo session', () => {
  it('tracks elapsed time through pause and resume', () => {
    const started = createPhotoSession(12, 1_000);
    const paused = pausePhotoSession(started, 6_000);
    assert.equal(photoSessionElapsedMs(paused, 20_000), 5_000);
    assert.equal(photoSessionElapsedMs(resumePhotoSession(paused, 20_000), 23_000), 8_000);
  });

  it('tracks uploads, completed items, and unique skips', () => {
    let session = createPhotoSession(5, 0);
    session = recordPhotoUpload(session, 3);
    session = completePhotoTarget(session);
    session = skipPhotoTarget(skipPhotoTarget(session, 'asset-1'), 'asset-1');
    assert.equal(session.photosAdded, 3);
    assert.equal(session.completed, 1);
    assert.deepEqual(session.skippedAssetIds, ['asset-1']);
  });

  it('persists a valid session', () => {
    const storage = memoryStorage();
    const session = pausePhotoSession(createPhotoSession(4, 10), 110);
    savePhotoSession(session, storage);
    assert.deepEqual(loadPhotoSession(storage), session);
  });

  it('formats compact elapsed time', () => {
    assert.equal(formatPhotoSessionDuration(65_000), '1:05');
    assert.equal(formatPhotoSessionDuration(3_665_000), '1:01:05');
  });
});
