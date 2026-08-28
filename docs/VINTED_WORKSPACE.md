# Vinted Wardrobe - Deferred Prototype

FlipTracker briefly shipped a category-filtered index of Vinted links associated with existing inventory records. The tab has been removed from application navigation and routing because browser login does not provide wardrobe data and Vinted Pro integration is not available for this US workflow.

The dormant implementation remains in `src/components/VintedPanel.tsx`, with URL helpers in `src/utils/vinted.ts`. Convex continues accepting the Vinted platform value so previously saved records are not destroyed.

## Prototype Workflow

1. Open the Vinted tab and select **Set Up Vinted**.
2. Save an account label, optional username, and Vinted wardrobe/profile URL.
3. Select **Open Vinted** and sign in directly on Vinted in the browser.
4. Select **Add Vinted Link** in FlipTracker.
5. Choose the matching inventory item and paste its Vinted item URL.
6. Confirm its category, status, price, condition, and private workflow notes.
7. Use the category chips, filters, search, and sorting controls to maintain the wardrobe.

This workflow required each listing link to be registered manually. FlipTracker did not request or store the Vinted password; the saved account record was a browser handoff and profile reference, not an OAuth connection.

## Integration Boundary

Vinted's standard-account terms prohibit unauthorized bots, scraping, crawling, and external software tools. FlipTracker therefore does not automatically read or modify a standard wardrobe.

Vinted provides an official Pro Integrations API for allowlisted Vinted Pro businesses, but that route is not available for this US seller workflow. Reconsider the feature only if Vinted introduces approved US inventory-read access. At that point FlipTracker can add server-side catalog import and status synchronization while retaining the same inventory and cross-listing records.

Official references:

- [Vinted Terms and Conditions](https://www.vinted.com/terms-and-conditions)
- [Vinted Pro Integrations API](https://pro-docs.svc.vinted.com/)
