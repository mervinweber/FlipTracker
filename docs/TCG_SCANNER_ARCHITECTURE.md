# TCG Scanner Architecture

## Product Decision

FlipTracker uses a confirmation-first card workflow:

1. Capture a clear card-front photo or enter the printed identifier.
2. Extract only high-signal identity fields with Gemini when photo recognition is used.
3. Automatically query the game-specific catalog adapter from those extracted fields; manual identifier entry remains a fallback.
4. Auto-select one unambiguous catalog result or present ranked variants to the seller.
5. Require the seller to choose the exact set, number, rarity, language, finish, and edition.
6. Capture and retain the actual front and back photos during intake.
7. Save one inventory record, both photos, and optionally create an internal eBay draft.
8. Keep a session ledger for exact-duplicate detection and low-value lot guidance.

Image recognition must never silently choose or price a printing. Shared artwork, reprints, promos, foils, languages, and first editions can have materially different values.

## Provider Strategy

### Yu-Gi-Oh!

- Preferred free-beta catalog: YGOPRODeck, using the printed set code such as `LOB-001`.
- The simple set-code endpoint can collapse a same-code card to one rarity. FlipTracker therefore resolves the card ID and uses detailed `cardinfo` set data so Super, Ultra, Secret, Ultimate, Collector's, Platinum Secret, Starlight, and Quarter Century Secret variants remain separate candidates.
- Rarity is part of the exact-print duplicate key. Two cards with the same printed set code but different rarity treatments must never be grouped as identical copies.
- Gemini may suggest a visually apparent rarity, but the seller must confirm foil coverage, name color, texture, and anniversary watermark. A single still photo is not authoritative for subtle foil variants.
- For older codes with later date reprints, Gemini also attempts to read `1st Edition` and the tiny `1996`/`2020` copyright mark. `1st Edition` is explicit; an Unlimited card with a 2020 mark is ranked toward a catalog candidate labeled `2020 Date Reprint`. These marks remain seller-confirmed because the text is extremely small.
- Cache catalog responses and respect the documented 20 requests-per-second limit.
- Do not continuously hotlink YGOPRODeck artwork. Download/rehost artwork before adding persistent previews.
- NEURON remains a useful UX reference, but Konami does not publish a developer recognition API. Do not scrape, automate, intercept, or reverse engineer the app.

References:

- https://ygoprodeck.com/api-guide/
- https://www.konami.com/games/eu/en/products/yugioh_neuron/
- https://legal.konami.com/games/neuron/terms/tou/en/

### Pokemon

- Preferred free-beta catalog: Pokemon TCG API, using set ID plus collector number and optional card name.
- Pokemon TCG API distinguishes broad price finishes such as normal, holofoil, and reverse holofoil, but it does not consistently separate modern Poke Ball and Master Ball patterns.
- FlipTracker enriches exact Pokemon matches with TCGCSV's free daily TCGplayer-derived product and price files. Pattern products such as `Poke Ball Pattern` and `Master Ball Pattern` become separate candidates even when set and collector number are identical.
- Finish is part of the exact-print duplicate key. Normal, Holofoil, Reverse Holofoil, Poke Ball Reverse Holo, and Master Ball Reverse Holo must be treated as different physical variants.
- Gemini may suggest the finish from a clear photo, but glare and angle make it advisory. The seller must confirm the repeated ball pattern under good light.
- `POKEMON_TCG_API_KEY` is optional but recommended for better rate limits.
- The official Pokemon card database is a seller-facing search resource, not a published developer API.

References:

- https://docs.pokemontcg.io/
- https://support.pokemon.com/hc/en-us/articles/360001025274-How-do-I-use-the-Trading-Card-Game-database

### TCGplayer

TCGplayer's API would be useful for catalog and market-price enrichment, but its official documentation says it is not granting new API access. FlipTracker therefore treats TCGplayer as an optional future adapter for approved credentials, not a launch dependency.

Reference: https://docs.tcgplayer.com/docs/getting-started

## Current Workflow

- `convex/cardCatalog.ts`: cached Pokemon and Yu-Gi-Oh! catalog adapters, same-code Yu-Gi-Oh! rarity expansion, and gated Gemini identifier/rarity extraction.
- `convex/cardIntake.ts`: seller-confirmed inventory and optional eBay-draft creation.
- `src/components/CardScannerPanel.tsx`: rapid phone workflow with paired front/back capture, candidate review, variant confirmation, destination selection, cost/bin/price, and immediate next-card reset.
- `src/utils/cardSession.ts`: deterministic duplicate grouping, individual/playset/bundle/hold guidance, and marketplace-ready listing copy.
- Card provider ID, language, rarity, finish, edition, identification method, and confidence are persisted.
- Actual item photos are resized, stored in Convex, and attached in front/back order during intake.
- Session recommendations use a seller-defined minimum individual-card value. They are operational guidance, not verified sold-price conclusions.
- Provider zeroes are treated as missing catalog quotes, never as genuine `$0.00` market values.
- Vinted-ready mode prepares the inventory record and copy for manual posting. FlipTracker does not automate or scrape Vinted.

## Required Configuration

- `GEMINI_API_KEY`: enables photo identifier extraction.
- `GEMINI_CARD_MODEL`: optional model override; defaults to `gemini-2.5-flash-lite`.
- `POKEMON_TCG_API_KEY`: optional Pokemon TCG API key.
- TCGCSV requires no API key and is used only as a cached variant-enrichment source.
- Existing `FLIPTRACKER_ADMIN_KEY`: gates Gemini use during the private single-seller beta.

## Next Card Slices

- Rehost permitted reference artwork in Convex storage with attribution and expiry rules.
- Add sports-card provider research before enabling sports image identification.
- Persist resumable multi-device card sessions and aggregate session cost/profit reporting.
- Add a bulk action that turns confirmed low-value duplicates into one explicit lot record without losing source-card traceability.
- Keep catalog reference prices separate from verified eBay sold comps.
- Add graded-card fields only after raw-card intake is dependable.
