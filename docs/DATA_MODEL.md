# Data Model

## collections
One purchase/source event.

## assets
One resale item. This is intentionally broader than games so we can later support cards, DVDs, Blu-rays, toys, and electronics.

Value fields include estimated ranges, local ranges, user override ranges, `valueSource`, and `needsValueCheck`. Title edits mark an asset for value review unless the saved patch explicitly clears the flag through a user override.

## sales
Sale events and fee/shipping details.

## valueHistory
Value snapshots over time.

## researchChecks
Research method, confidence, notes, and recommendation.
