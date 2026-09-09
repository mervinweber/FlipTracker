function compact(value?: string) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function comparable(value?: string) {
  return compact(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function appendUniqueDisclosure(existing: string | undefined, addition: string) {
  const current = existing?.trim() || '';
  const next = compact(addition);
  if (!next) return current || undefined;
  if (comparable(current).includes(comparable(next))) return current;
  return current ? `${current}\n${next}` : next;
}

function replaceOrAppendDetail(description: string, label: string, value?: string) {
  const next = compact(value);
  if (!next) return description;
  const line = `${label}: ${next}`;
  const matcher = new RegExp(`^${label}:.*$`, 'im');
  return matcher.test(description) ? description.replace(matcher, line) : `${description.trim()}\n${line}`.trim();
}

export function updateListingDescription(input: {
  description?: string;
  title: string;
  condition?: string;
  completeness?: string;
  disclosure?: string;
  bundleMember?: boolean;
}) {
  let description = input.description?.trim() || input.title.trim();
  description = replaceOrAppendDetail(description, 'Condition', input.condition);
  description = replaceOrAppendDetail(description, 'Completeness', input.completeness);
  const disclosure = compact(input.disclosure);
  if (disclosure && !comparable(description).includes(comparable(disclosure))) {
    const label = input.bundleMember ? `Item details for ${input.title}` : 'Item details';
    description = `${description}\n${label}: ${disclosure}`.trim();
  }
  return description;
}
