export type SmartPreparationSource = 'Defaults' | 'AI' | 'Market';

export type SmartListingValue = string | number | boolean | undefined;

export type SmartListingInput = {
  title?: string;
  description?: string;
  currentPrice?: number;
  listedPrice?: number;
  pricingSource?: string;
  category?: string;
  ebayCategoryId?: string;
  fulfillmentPolicyId?: string;
  shippingPreset?: string;
  packageWeightOz?: number;
  packageLengthIn?: number;
  packageWidthIn?: number;
  packageHeightIn?: number;
  language?: string;
  bookTitle?: string;
  author?: string;
  imageMode?: string;
};

export type SmartAiDraft = {
  title?: string;
  description?: string;
  confidence?: number;
  warnings?: string[];
  provider?: string;
  model?: string;
};

export type SmartMarketDraft = {
  suggestedPrice?: number;
  confidence?: string;
  matchCount?: number;
  source?: string;
  warning?: string;
};

export type SmartPreparationChange = {
  key: string;
  field: keyof SmartListingInput;
  label: string;
  before?: string | number | boolean;
  after: string | number | boolean;
  source: SmartPreparationSource;
  confidence: 'High' | 'Medium' | 'Low';
  recommended: boolean;
  reason: string;
};

export type SmartPreparationPlan = {
  changes: SmartPreparationChange[];
  warnings: string[];
  aiProvider?: string;
  aiModel?: string;
  marketMatchCount?: number;
};

const DEFAULT_FIELDS: Array<{ field: keyof SmartListingInput; label: string }> = [
  { field: 'category', label: 'Category' },
  { field: 'ebayCategoryId', label: 'Category route' },
  { field: 'language', label: 'Language' },
  { field: 'bookTitle', label: 'Book title' },
  { field: 'author', label: 'Author' },
  { field: 'shippingPreset', label: 'Shipping profile' },
  { field: 'fulfillmentPolicyId', label: 'Shipping policy' },
  { field: 'packageWeightOz', label: 'Package weight' },
  { field: 'packageLengthIn', label: 'Package length' },
  { field: 'packageWidthIn', label: 'Package width' },
  { field: 'packageHeightIn', label: 'Package height' },
  { field: 'imageMode', label: 'Photo source' },
];

function present(value: SmartListingValue): value is string | number | boolean {
  return value !== undefined && value !== '';
}

function same(left: SmartListingValue, right: SmartListingValue) {
  return String(left ?? '').trim() === String(right ?? '').trim();
}

function genericTitle(value?: string) {
  const title = value?.trim() || '';
  return title.length < 8 || /^(unknown|untitled|manual item|general merchandise)$/i.test(title);
}

function confidenceLabel(value?: number): 'High' | 'Medium' | 'Low' {
  if ((value || 0) >= 0.85) return 'High';
  if ((value || 0) >= 0.65) return 'Medium';
  return 'Low';
}

export function buildSmartPreparationPlan(
  original: SmartListingInput,
  defaults: SmartListingInput,
  ai?: SmartAiDraft,
  market?: SmartMarketDraft,
): SmartPreparationPlan {
  const changes: SmartPreparationChange[] = [];

  for (const { field, label } of DEFAULT_FIELDS) {
    const before = original[field];
    const after = defaults[field];
    if (!present(after) || same(before, after)) continue;
    changes.push({
      key: `default:${String(field)}`,
      field,
      label,
      before: present(before) ? before : undefined,
      after,
      source: 'Defaults',
      confidence: 'High',
      recommended: !present(before),
      reason: present(before) ? 'A seller value already exists, so this stays optional.' : 'Filled from the saved item-family workflow.',
    });
  }

  const aiConfidence = confidenceLabel(ai?.confidence);
  const proposedTitle = ai?.title?.trim().slice(0, 80);
  if (proposedTitle && !same(original.title, proposedTitle)) {
    changes.push({
      key: 'ai:title',
      field: 'title',
      label: 'Buyer-facing title',
      before: original.title,
      after: proposedTitle,
      source: 'AI',
      confidence: aiConfidence,
      recommended: genericTitle(original.title),
      reason: genericTitle(original.title) ? 'The current title is incomplete or generic.' : 'Existing seller titles are preserved unless you choose this rewrite.',
    });
  }

  const proposedDescription = ai?.description?.trim();
  if (proposedDescription && !same(original.description, proposedDescription)) {
    const currentDescription = original.description?.trim() || '';
    changes.push({
      key: 'ai:description',
      field: 'description',
      label: 'Buyer-facing description',
      before: currentDescription || undefined,
      after: proposedDescription,
      source: 'AI',
      confidence: aiConfidence,
      recommended: currentDescription.length < 40,
      reason: currentDescription.length < 40 ? 'The listing does not yet have useful buyer-facing copy.' : 'Existing seller copy is preserved unless you choose this rewrite.',
    });
  }

  if (market?.suggestedPrice && market.suggestedPrice > 0) {
    const currentPrice = original.currentPrice ?? original.listedPrice;
    if (currentPrice !== market.suggestedPrice) {
      changes.push({
        key: 'market:currentPrice',
        field: 'currentPrice',
        label: 'Listing price',
        before: currentPrice,
        after: market.suggestedPrice,
        source: 'Market',
        confidence: market.confidence === 'High' ? 'High' : market.confidence === 'Medium' ? 'Medium' : 'Low',
        recommended: !currentPrice,
        reason: currentPrice
          ? 'A price already exists, so the market recommendation stays optional.'
          : `Based on ${market.matchCount || 0} credible active eBay match${market.matchCount === 1 ? '' : 'es'}.`,
      });
    }
  }

  return {
    changes,
    warnings: [
      ...(ai?.warnings || []),
      ...(market?.warning ? [market.warning] : []),
      ...(market && !market.suggestedPrice ? ['No credible market price was available; enter or confirm the price manually.'] : []),
    ],
    aiProvider: ai?.provider,
    aiModel: ai?.model,
    marketMatchCount: market?.matchCount,
  };
}

export function recommendedSmartChangeKeys(plan: SmartPreparationPlan) {
  return new Set(plan.changes.filter((change) => change.recommended).map((change) => change.key));
}

export function applySmartPreparation<T extends SmartListingInput>(
  listing: T,
  plan: SmartPreparationPlan,
  selectedKeys: ReadonlySet<string>,
): T {
  const patch: SmartListingInput = {};
  for (const change of plan.changes) {
    if (selectedKeys.has(change.key)) {
      (patch as Record<string, SmartListingValue>)[String(change.field)] = change.after;
    }
  }
  const marketPriceApplied = plan.changes.some((change) => change.key === 'market:currentPrice' && selectedKeys.has(change.key));
  if (marketPriceApplied) {
    patch.pricingSource = `Smart Prepare · ${plan.marketMatchCount || 0} active eBay matches`;
  }
  return { ...listing, ...patch };
}
