# Game Metadata Model

This document captures the planned video-game-specific metadata model before backend schema changes are made.

## Goal

Make game inventory records more accurate for resale decisions by separating physical contents, condition, region, and value confidence. The current `complete` and `manual` fields are useful but too limited.

## Completeness

Recommended user-facing field: `Completeness`.

Suggested values:

- Disc only
- Cartridge only
- Case only
- Manual only
- Disc + case
- Disc + manual
- Case + manual
- Complete in box / CIB
- Sealed
- Loose
- Replacement case/artwork
- Other

For future flexibility, this may become a checklist rather than a single enum:

- Has game media
- Has original case/box
- Has manual
- Has cover art
- Has inserts
- Is sealed
- Has replacement artwork

## Region

Recommended user-facing field: `Region`.

Suggested values:

- NTSC-U/C
- NTSC-J
- PAL
- Region-free
- Unknown
- Other

Region should matter in value research, duplicate detection, and listing text.

## Condition

Condition should eventually be split into media, case/box, and manual condition.

Suggested fields:

- Media condition
- Case/box condition
- Manual condition
- Overall condition

Suggested values:

- New
- Like new
- Very good
- Good
- Acceptable
- Poor
- Untested

## Resale Signals

These fields should support buy/skip and list-first decisions:

- Completeness
- Region
- Condition
- Storage location / bin
- Tested status
- Value confidence
- Needs value check
- Red flags
- Suggested strategy

Potential red flags:

- Missing game media
- Missing case/manual on a title where CIB premium matters
- PAL/NTSC mismatch
- Untested disc/cartridge
- Low sold-comp count
- High shipping drag
- Reproduction or replacement artwork

## Migration Notes

Existing fields should be preserved during the transition:

- `complete`
- `manual`
- `condition`

## Storage Location

FlipTracker should support item-level physical location tracking so inventory can be found quickly after the app grows.

Recommended user-facing field: `Storage location`.

Suggested examples:

- Bin A1
- Shelf 2
- Tote: PS2 loose discs
- Case: High value games
- Listed inventory rack
- Office desk review pile

Recommended future schema fields:

- `storageLocation`: free-text user label for fast entry.
- `storageArea`: optional normalized area such as office, garage, storage unit, shelf, listed rack.
- `binCode`: optional structured bin/shelf code.

Do not add this only as a frontend field until Convex schema, mutations, import/export, and filters all support it; otherwise users could enter data that is not saved.

Suggested migration mapping:

- `complete: true` and `manual: true` -> `Complete in box / CIB`
- `complete: true` and `manual: false` -> `Disc + case` or `Cartridge + box`, pending media type
- `manual: true` alone -> keep as a contents flag until reviewed

Do not delete old fields until import/export, Convex schema, and UI have a backwards-compatible path.

## UI Plan

First frontend-only pass:

- Replace loose `Complete` and `Manual` checkboxes with clearer labels.
- Add planned option lists to docs.
- Avoid schema changes until the final model is chosen.

Future schema pass:

- Add `completeness`, `region`, `mediaCondition`, `caseCondition`, and `manualCondition`.
- Update Excel import/export.
- Backfill from `complete`, `manual`, and `condition`.
- Add filters and badges.
