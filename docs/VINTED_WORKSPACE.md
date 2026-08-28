# Vinted Wardrobe

FlipTracker's Vinted tab is a category-filtered index of Vinted listings linked to existing inventory records. It is designed for quickly finding a group such as Books, opening the exact marketplace item, making the change on Vinted, and returning to the same filtered FlipTracker view.

## Standard Account Setup

1. Open the Vinted tab and select **Set Up Vinted**.
2. Save an account label, optional username, and Vinted wardrobe/profile URL.
3. Select **Open Vinted** and sign in directly on Vinted in the browser.
4. Select **Add Vinted Link** in FlipTracker.
5. Choose the matching inventory item and paste its Vinted item URL.
6. Confirm its category, status, price, condition, and private workflow notes.
7. Use the category chips, filters, search, and sorting controls to maintain the wardrobe.

FlipTracker does not request or store the Vinted password. The saved account record is a browser handoff and profile reference, not an OAuth connection.

## Integration Boundary

Vinted's standard-account terms prohibit unauthorized bots, scraping, crawling, and external software tools. FlipTracker therefore does not automatically read or modify a standard wardrobe.

Vinted provides an official Pro Integrations API for allowlisted Vinted Pro businesses. If the seller account becomes eligible and Vinted grants access, FlipTracker can add server-side catalog import and status synchronization while retaining the same inventory and cross-listing records.

Official references:

- [Vinted Terms and Conditions](https://www.vinted.com/terms-and-conditions)
- [Vinted Pro Integrations API](https://pro-docs.svc.vinted.com/)
