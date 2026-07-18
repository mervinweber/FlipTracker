# AGENTS.md

## Project Mission
Build FlipTracker: a local-first PWA for tracking resale inventory, starting with video games and expanding to cards, DVDs, Blu-rays, toys, and collectibles.

## Non-Negotiables
- Local-first by default.
- No Railway, Supabase, Firebase, or hosted backend unless explicitly approved.
- Excel import/export must stay working.
- Preserve user data and be careful with IndexedDB migrations.
- Keep code clean, documented, and easy to extend.

## Tech Stack
- React + TypeScript + Vite
- Dexie / IndexedDB
- SheetJS/xlsx
- PWA-ready

## Agent Workflow
- Read `docs/PROJECT_MEMORY.md` at the start of substantial work.
- Check `docs/PRODUCT_IDENTITY.md` before changing major UI patterns.
- Track next steps in TODO.md.
- Update SETUP.md when install/run steps change.
- Add notes to docs/ when adding larger features.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
