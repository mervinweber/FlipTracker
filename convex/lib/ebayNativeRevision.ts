function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function scalarText(value: unknown) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return scalarText(record['#text'] ?? record.value);
  }
  return '';
}

function aspectKey(aspects: Record<string, string[]>, name: string) {
  const normalized = name.trim().toLowerCase();
  return Object.keys(aspects).find((key) => key.trim().toLowerCase() === normalized);
}

function xmlValue(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function remoteItemSpecifics(value: unknown) {
  const aspects: Record<string, string[]> = {};
  if (!value || typeof value !== 'object') return aspects;
  const lists = asArray((value as { NameValueList?: unknown | unknown[] }).NameValueList);
  for (const list of lists) {
    if (!list || typeof list !== 'object') continue;
    const row = list as { Name?: unknown; Value?: unknown | unknown[] };
    const name = scalarText(row.Name).trim();
    const values = asArray(row.Value).map((entry) => scalarText(entry).trim()).filter(Boolean);
    if (name && values.length) aspects[name] = values;
  }
  return aspects;
}

export function mergeItemSpecifics(remote: Record<string, string[]>, local: Record<string, string[]>) {
  const merged = { ...remote };
  for (const [name, values] of Object.entries(local)) {
    const existing = aspectKey(merged, name);
    if (existing && existing !== name) delete merged[existing];
    if (values.length) merged[name] = values;
  }
  return merged;
}

export function itemSpecificsXml(aspects: Record<string, string[]>) {
  const rows = Object.entries(aspects)
    .filter(([name, values]) => name.trim() && values.some((value) => value.trim()))
    .map(([name, values]) => `<NameValueList><Name>${xmlValue(name)}</Name>${values
      .filter((value) => value.trim())
      .map((value) => `<Value>${xmlValue(value)}</Value>`)
      .join('')}</NameValueList>`)
    .join('');
  return rows ? `<ItemSpecifics>${rows}</ItemSpecifics>` : '';
}

export function conditionIdForNativeListing(condition?: string, fallback?: unknown) {
  const normalized = condition?.trim().toLowerCase() ?? '';
  if (!normalized) return scalarText(fallback);
  if (['new', 'brand new', 'sealed'].includes(normalized)) return '1000';
  if (normalized.includes('new other')) return '1500';
  if (normalized.includes('like new')) return '2750';
  if (normalized.includes('very good')) return '4000';
  if (normalized.includes('acceptable')) return '6000';
  if (normalized.includes('parts')) return '7000';
  if (normalized.includes('good') || normalized.includes('used')) return '5000';
  return scalarText(fallback);
}
