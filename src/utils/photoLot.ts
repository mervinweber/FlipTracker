export function splitPhotoLotTotal(total: string, count: number) {
  const parsed = Number(total);
  const cents = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
  if (!cents || count < 1) return Array.from({ length: Math.max(0, count) }, () => '');
  const each = Math.floor(cents / count);
  const remainder = cents - each * count;
  return Array.from({ length: count }, (_, index) => ((each + (index < remainder ? 1 : 0)) / 100).toFixed(2));
}
