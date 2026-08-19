import { useEffect, useMemo, useState } from 'react';
import { useAction } from 'convex/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../../convex/_generated/api';

type CategoryAspect = {
  name: string;
  required: boolean;
  mode: string;
  cardinality: string;
  values: string[];
  valueCount: number;
  valuesTruncated: boolean;
  maxLength: number | null;
};

type AspectResult = {
  aspects: CategoryAspect[];
};

const aspectCache = new Map<string, CategoryAspect[]>();
const STRUCTURED_ASPECTS = new Set([
  'author', 'book title', 'language', 'type', 'brand', 'department', 'size', 'color', 'material', 'style',
  'game', 'sport', 'set', 'card number', 'player/athlete', 'team',
]);

function parseSpecifics(value?: string) {
  const entries = new Map<string, { name: string; value: string }>();
  for (const line of value?.split('\n') || []) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    const itemValue = line.slice(separator + 1).trim();
    if (name && itemValue) entries.set(name.toLowerCase(), { name, value: itemValue });
  }
  return entries;
}

function setSpecific(value: string | undefined, name: string, nextValue: string) {
  const entries = parseSpecifics(value);
  const key = name.toLowerCase();
  if (nextValue.trim()) entries.set(key, { name, value: nextValue.trim() });
  else entries.delete(key);
  return [...entries.values()].map((entry) => `${entry.name}: ${entry.value}`).join('\n');
}

export default function EbayCategoryAspects({
  categoryId,
  marketplaceId = 'EBAY_US',
  itemSpecifics,
  onChange,
  onMissingRequiredChange,
}: {
  categoryId?: string;
  marketplaceId?: string;
  itemSpecifics?: string;
  onChange: (itemSpecifics: string) => void;
  onMissingRequiredChange?: (names: string[]) => void;
}) {
  const getCategoryAspects = useAction(api.ebayTaxonomy.getCategoryAspects);
  const [aspects, setAspects] = useState<CategoryAspect[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const values = useMemo(() => parseSpecifics(itemSpecifics), [itemSpecifics]);

  async function load(force = false) {
    if (!categoryId) return;
    const cacheKey = `${marketplaceId}:${categoryId}`;
    if (!force && aspectCache.has(cacheKey)) {
      setAspects(aspectCache.get(cacheKey) || []);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getCategoryAspects({ marketplaceId, categoryId }) as AspectResult;
      const ordered = result.aspects
        .filter((aspect) => !STRUCTURED_ASPECTS.has(aspect.name.trim().toLowerCase()))
        .sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name));
      aspectCache.set(cacheKey, ordered);
      setAspects(ordered);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load eBay item specifics.');
      setAspects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setAspects([]);
    setError('');
    void load();
  }, [categoryId, marketplaceId]);

  const required = useMemo(() => aspects.filter((aspect) => aspect.required), [aspects]);
  const recommended = useMemo(() => aspects.filter((aspect) => !aspect.required).slice(0, 12), [aspects]);
  useEffect(() => {
    onMissingRequiredChange?.(required.filter((aspect) => !values.get(aspect.name.toLowerCase())?.value).map((aspect) => aspect.name));
  }, [onMissingRequiredChange, required, values]);

  if (!categoryId) return <p className="categoryAspectEmpty"><AlertTriangle size={15}/> Choose a leaf category to load its required eBay fields.</p>;
  const renderAspect = (aspect: CategoryAspect) => {
    const currentValue = values.get(aspect.name.toLowerCase())?.value || '';
    const knownValue = aspect.values.includes(currentValue);
    const listId = `aspect-${categoryId}-${aspect.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return <label key={aspect.name}>{aspect.name}{aspect.required ? <strong className="requiredMark">Required</strong> : null}
      {aspect.values.length && !aspect.valuesTruncated ? <select value={currentValue} onChange={(event) => onChange(setSpecific(itemSpecifics, aspect.name, event.target.value))}>
        <option value="">Choose {aspect.name.toLowerCase()}</option>
        {currentValue && !knownValue ? <option value={currentValue}>{currentValue}</option> : null}
        {aspect.values.map((option) => <option key={option} value={option}>{option}</option>)}
      </select> : <><input list={aspect.values.length ? listId : undefined} maxLength={aspect.maxLength || undefined} value={currentValue} onChange={(event) => onChange(setSpecific(itemSpecifics, aspect.name, event.target.value))}/>{aspect.values.length ? <datalist id={listId}>{aspect.values.map((option) => <option key={option} value={option}/>)}</datalist> : null}{aspect.valuesTruncated ? <small>Showing the first {aspect.values.length.toLocaleString()} of {aspect.valueCount.toLocaleString()} eBay values; type to enter another exact value.</small> : null}</>}
    </label>;
  };

  return <section className="ebayCategoryAspects">
    <div className="aspectHeader"><div><strong>Additional eBay category fields</strong><small>{loading ? 'Loading category requirements...' : `${required.length} additional required · ${aspects.length} available`}</small></div><button type="button" className="iconButton secondary" disabled={loading} onClick={() => load(true)} aria-label="Refresh eBay category fields" title="Refresh category fields"><RefreshCw size={15}/></button></div>
    {error ? <p className="formError">{error}</p> : null}
    {!loading && !error && !aspects.length ? <p className="compactText">No category aspects were returned. Refresh or use Additional Item Specifics.</p> : null}
    {required.length ? <div className="sectionGrid aspectGrid">{required.map(renderAspect)}</div> : null}
    {recommended.length ? <details className="advancedListingOptions"><summary>Recommended item specifics ({recommended.length})</summary><div className="advancedListingBody sectionGrid aspectGrid">{recommended.map(renderAspect)}</div></details> : null}
  </section>;
}
