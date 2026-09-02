# Smart Listing Prepare

Smart Prepare reduces the normal eBay queue workflow to one assisted review before save or staging.

## Seller Flow

1. Scan or import an item into Inventory and create its internal eBay draft.
2. Select **Prepare** from the Queue, or start a seller session and scan the item's UPC/SKU.
3. FlipTracker combines saved item-family defaults, AI listing copy, and active eBay market guidance.
4. Missing, high-confidence values are applied to the unsaved review automatically.
5. Existing seller-entered titles, descriptions, and prices remain authoritative. Alternative suggestions require an explicit **Use** action.
6. Correct any highlighted exception, then select **Save & Next** or **Save, Stage & Next**.

Nothing from Smart Prepare reaches Convex or eBay until the seller saves or stages the listing.

## Decision Rules

- Category, language, book identity, shipping profile, package measurements, policy, and photo-source defaults come from deterministic FlipTracker rules and saved seller presets.
- Gemini or OpenAI may propose an eBay title and buyer-facing description using only supplied inventory facts and buyer-relevant condition notes.
- AI may not invent condition, testing, authenticity, included pieces, edition, rarity, provenance, or specifications.
- AI title rewrites are automatic only when the current title is empty or generic.
- AI descriptions are automatic only when buyer-facing copy is missing or too short to be useful.
- Pricing comes from FlipTracker's eBay active-market lookup, not from the language model.
- A market price is automatic only when no seller price exists. Existing prices require explicit approval before replacement.
- Missing or low-confidence results become compact warnings and never block deterministic preparation.

## Current Limits

- eBay market guidance is based on credible active listings and is not verified sold-comps data.
- Photo quality, glare, and crop analysis are not yet part of Smart Prepare.
- Card variant identification remains seller-confirmed before saving.
- Smart Prepare requires the local Seller Access Key for provider calls; workflow defaults still work without it.

## Next Validation

- Run a real 20-item DVD/book queue and measure Prepare-to-Stage time.
- Run a mixed Pokemon/Yu-Gi-Oh! session and record false-positive title or variant suggestions.
- Tune automatic thresholds only from observed seller corrections.

