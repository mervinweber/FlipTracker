export type PhotoSession = {
  startedAt: number;
  activeSince?: number;
  elapsedMs: number;
  initialTotal: number;
  completed: number;
  photosAdded: number;
  skippedAssetIds: string[];
};

export const PHOTO_SESSION_STORAGE_KEY = 'fliptrackerPhotoSession';

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createPhotoSession(initialTotal: number, now = Date.now()): PhotoSession {
  return { startedAt: now, activeSince: now, elapsedMs: 0, initialTotal: Math.max(0, initialTotal), completed: 0, photosAdded: 0, skippedAssetIds: [] };
}

export function photoSessionElapsedMs(session: PhotoSession, now = Date.now()) {
  return session.elapsedMs + (session.activeSince ? Math.max(0, now - session.activeSince) : 0);
}

export function pausePhotoSession(session: PhotoSession, now = Date.now()): PhotoSession {
  if (!session.activeSince) return session;
  return { ...session, elapsedMs: photoSessionElapsedMs(session, now), activeSince: undefined };
}

export function resumePhotoSession(session: PhotoSession, now = Date.now()): PhotoSession {
  return session.activeSince ? session : { ...session, activeSince: now };
}

export function recordPhotoUpload(session: PhotoSession, count: number): PhotoSession {
  return { ...session, photosAdded: session.photosAdded + Math.max(0, count) };
}

export function completePhotoTarget(session: PhotoSession): PhotoSession {
  return { ...session, completed: session.completed + 1 };
}

export function skipPhotoTarget(session: PhotoSession, assetId: string): PhotoSession {
  return session.skippedAssetIds.includes(assetId) ? session : { ...session, skippedAssetIds: [...session.skippedAssetIds, assetId] };
}

export function loadPhotoSession(storage: Pick<SessionStorage, 'getItem'>): PhotoSession | null {
  try {
    const value = JSON.parse(storage.getItem(PHOTO_SESSION_STORAGE_KEY) || 'null') as Partial<PhotoSession> | null;
    if (!value || typeof value.startedAt !== 'number' || typeof value.elapsedMs !== 'number') return null;
    return {
      startedAt: value.startedAt,
      activeSince: typeof value.activeSince === 'number' ? value.activeSince : undefined,
      elapsedMs: value.elapsedMs,
      initialTotal: Number(value.initialTotal) || 0,
      completed: Number(value.completed) || 0,
      photosAdded: Number(value.photosAdded) || 0,
      skippedAssetIds: Array.isArray(value.skippedAssetIds) ? value.skippedAssetIds.filter((id): id is string => typeof id === 'string') : [],
    };
  } catch {
    return null;
  }
}

export function savePhotoSession(session: PhotoSession, storage: Pick<SessionStorage, 'setItem'>) {
  storage.setItem(PHOTO_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearPhotoSession(storage: Pick<SessionStorage, 'removeItem'>) {
  storage.removeItem(PHOTO_SESSION_STORAGE_KEY);
}

export function formatPhotoSessionDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}
