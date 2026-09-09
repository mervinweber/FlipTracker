export function allocateLotTotal(total: number, count: number): number[] {
  if (!Number.isFinite(total) || total < 0) throw new Error('Purchase total must be a non-negative number.');
  if (!Number.isInteger(count) || count < 0) throw new Error('Item count must be a non-negative integer.');
  if (count === 0) return [];

  const totalCents = Math.round(total * 100);
  const eachCents = Math.floor(totalCents / count);
  const remainder = totalCents - eachCents * count;
  return Array.from({ length: count }, (_, index) => (eachCents + (index < remainder ? 1 : 0)) / 100);
}
