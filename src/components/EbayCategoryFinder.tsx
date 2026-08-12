import { useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { Check, Search } from 'lucide-react';
import { api } from '../../convex/_generated/api';

export type EbayCategorySuggestion = {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
};

type EbayCategoryFinderProps = {
  query: string;
  selectedCategoryId?: string;
  onSelect: (suggestion: EbayCategorySuggestion) => void;
};

function readableLookupError(error: unknown) {
  const raw = error instanceof Error ? error.message : 'eBay category lookup failed.';
  const convexMessage = raw.match(/Uncaught ConvexError:\s*([^\n]+?)(?:\s+at handler|\s+Called by client|$)/)?.[1];
  return convexMessage || raw;
}

export default function EbayCategoryFinder({ query, selectedCategoryId, onSelect }: EbayCategoryFinderProps) {
  const suggestCategories = useAction(api.ebay.suggestCategories);
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState(query);
  const [suggestions, setSuggestions] = useState<EbayCategorySuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) setSearchText(query);
  }, [query, open]);

  async function findCategories(phrase = searchText || query) {
    const normalized = phrase.trim().replace(/\s+/g, ' ');
    setOpen(true);
    if (normalized.length < 3) {
      setError('Enter at least three characters that describe the item.');
      setSuggestions([]);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await suggestCategories({ query: normalized, marketplaceId: 'EBAY_US' });
      if (!result.ok) {
        setSuggestions([]);
        setError(result.error);
        return;
      }
      setSuggestions(result.suggestions);
      if (!result.suggestions.length) setError('eBay did not return a matching leaf category. Try a more specific description.');
    } catch (lookupError) {
      setSuggestions([]);
      setError(readableLookupError(lookupError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ebayCategoryFinder span2">
      <div className="categoryFinderToolbar">
        <div>
          <strong>eBay Category Finder</strong>
          <small>Search eBay and choose the closest leaf category before staging.</small>
        </div>
        <button type="button" className="secondary" disabled={busy} onClick={() => findCategories(open ? searchText : query)}>
          <Search size={16}/>{busy ? 'Searching...' : 'Find Category'}
        </button>
      </div>
      {open ? (
        <div className="categoryFinderResults">
          <div className="categoryFinderSearch">
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void findCategories(); } }} placeholder="Example: vintage desk lamp brass"/>
            <button type="button" aria-label="Search eBay categories" disabled={busy} onClick={() => findCategories()}><Search size={16}/></button>
          </div>
          {error ? <p className="formError">{error}</p> : null}
          {suggestions.length ? <div className="categorySuggestionList">{suggestions.map((suggestion) => (
            <button type="button" className={selectedCategoryId === suggestion.categoryId ? 'selected' : ''} key={suggestion.categoryId} onClick={() => { onSelect(suggestion); setOpen(false); }}>
              <span><strong>{suggestion.categoryName}</strong><small>{suggestion.categoryPath}</small></span>
              <span className="categorySuggestionId">{selectedCategoryId === suggestion.categoryId ? <Check size={15}/> : null}{suggestion.categoryId}</span>
            </button>
          ))}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
