export function readableActionError(error: unknown, fallback: string) {
  const data = error && typeof error === 'object' && 'data' in error
    ? (error as { data?: unknown }).data
    : undefined;
  const candidates = [
    typeof data === 'string' ? data : '',
    error instanceof Error ? error.message : '',
    typeof error === 'string' ? error : '',
    String(error || ''),
  ];

  for (const candidate of candidates) {
    const raw = candidate.trim();
    if (!raw) continue;
    const convexMessage = raw.match(/Uncaught ConvexError:\s*([^\n]+?)(?:\s+at handler|\s+Called by client|$)/)?.[1];
    if (convexMessage) return convexMessage.trim();
    if (!/^(?:Error:\s*)?\[CONVEX\b/.test(raw) && raw !== 'Server Error Called by client') return raw;
  }

  return fallback;
}

export function ebaySpecificsStepForError(message: string) {
  return /required ebay item specifics|item specific|publication name/i.test(message) ? 'category' : undefined;
}
