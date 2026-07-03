# TODO.md

## Done in Phase 1 Starter
- [x] Vite React TypeScript scaffold
- [x] Local IndexedDB database
- [x] Dashboard cards
- [x] Search/filter inventory
- [x] Excel export
- [x] Excel import
- [x] Starter 122-game inventory seed

## Next
- [ ] Editable item detail drawer/page
- [ ] Bulk edit status and condition
- [ ] Purchase lots/collections table
- [ ] Suggested max offer calculator
- [ ] Listing queue: highest value / fastest sellers first
- [ ] Console/type summary charts
- [ ] Barcode scanner prototype
- [ ] Photo/spine import workflow
- [ ] eBay sold lookup integration research

## Inventory Cleanup
- [ ] Confirm Medium/Low confidence rows against actual cases
- [ ] Add missing games from any new photos
- [ ] Add actual purchase price once known
- [ ] Check discs/manuals and update columns


## Phase 1.1 Feedback Added
- [x] Delete inventory line with automatic recalculation
- [x] Edit item title/status/value fields
- [x] Mark title changes as needing value re-check
- [x] Add user value override fields
- [x] Export user override fields to Excel
- [ ] Add external eBay sold-search link per item
- [ ] Add current sold-comps workflow


## Convex Integration
- [x] Add Convex package
- [x] Add Convex schema
- [x] Add assets API
- [x] Add collections API
- [x] Add research/value history API
- [x] Add reports dashboard API
- [x] Switch UI reads from Dexie to Convex `useQuery`
- [x] Switch UI writes from Dexie to Convex `useMutation`
- [x] Add Excel import to Convex mutation
- [ ] Add auth strategy
- [ ] Deploy to Vercel


## Convex UI Migration
- [x] Main inventory table now reads from Convex
- [x] Add/edit/delete now use Convex mutations
- [x] Dashboard cards use Convex reports query
- [x] Excel import writes to Convex
- [x] Excel export still works from Convex query rows
- [x] User value overrides and title-change value checks preserved
- [x] Research button opens eBay sold/completed search
- [ ] Add saved research modal connected to `research.addValueCheck`
- [ ] Add collections page
- [ ] Add auth before production use
