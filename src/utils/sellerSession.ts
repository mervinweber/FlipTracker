export type SellerSession = {
  startedAt: number;
  activeSince?: number;
  elapsedMs: number;
  reviewed: number;
  staged: number;
  published: number;
};

export type SellerSessionEvent = 'reviewed' | 'staged' | 'published';

export const SELLER_SESSION_STORAGE_KEY = 'fliptrackerSellerSession';

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createSellerSession(now = Date.now()): SellerSession {
  return { startedAt: now, activeSince: now, elapsedMs: 0, reviewed: 0, staged: 0, published: 0 };
}

export function sellerSessionElapsedMs(session: SellerSession, now = Date.now()) {
  return session.elapsedMs + (session.activeSince ? Math.max(0, now - session.activeSince) : 0);
}

export function pauseSellerSession(session: SellerSession, now = Date.now()): SellerSession {
  if (!session.activeSince) return session;
  return { ...session, elapsedMs: sellerSessionElapsedMs(session, now), activeSince: undefined };
}

export function resumeSellerSession(session: SellerSession, now = Date.now()): SellerSession {
  return session.activeSince ? session : { ...session, activeSince: now };
}

export function recordSellerSessionEvent(session: SellerSession, event: SellerSessionEvent): SellerSession {
  return { ...session, [event]: session[event] + 1 };
}

export function loadSellerSession(storage: Pick<SessionStorage, 'getItem'>): SellerSession | null {
  try {
    const value = JSON.parse(storage.getItem(SELLER_SESSION_STORAGE_KEY) || 'null') as Partial<SellerSession> | null;
    if (!value || typeof value.startedAt !== 'number' || typeof value.elapsedMs !== 'number') return null;
    return {
      startedAt: value.startedAt,
      activeSince: typeof value.activeSince === 'number' ? value.activeSince : undefined,
      elapsedMs: value.elapsedMs,
      reviewed: Number(value.reviewed) || 0,
      staged: Number(value.staged) || 0,
      published: Number(value.published) || 0,
    };
  } catch {
    return null;
  }
}

export function saveSellerSession(session: SellerSession, storage: Pick<SessionStorage, 'setItem'>) {
  storage.setItem(SELLER_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSellerSession(storage: Pick<SessionStorage, 'removeItem'>) {
  storage.removeItem(SELLER_SESSION_STORAGE_KEY);
}

export function formatSellerSessionDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}
