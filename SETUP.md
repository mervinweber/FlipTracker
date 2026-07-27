# SETUP.md

## Requirements
- Node.js 20+
- npm
- GitHub
- Vercel
- Convex

## Install

```bash
npm install
```

## Run Frontend

```bash
npm run dev
```

Set `VITE_CONVEX_URL` in `.env.local` before using the migrated UI. Without it, the app shows a setup message instead of loading inventory.

## Run Convex

```bash
npx convex dev
```

## Build

```bash
npm run build
```

## Deploy

See `docs/DEPLOYMENT.md`.

For the full ordered owner checklist, including security and smoke tests, follow `TODO.md` from "Beta Launch Blockers" onward.


## Convex UI Notes

After `npx convex dev` runs, Convex generates `convex/_generated/*`.
The React app imports those generated files. Keep them committed after schema or API changes, and regenerate them with Convex before building locally against a real deployment.

Recommended local workflow:

```bash
npm install
npx convex dev
npm run dev
```

The inventory table, dashboard cards, add/edit/delete actions, and Excel import now use Convex. Excel export still runs in the browser from the current Convex query result.


## Barcode Scanning

The media scanner uses the phone camera through the browser. Camera access requires HTTPS in production or `localhost` for local testing. If camera permissions fail, use the manual UPC/EAN/ISBN entry field.

Metadata lookup is handled by Convex actions. ISBN/book lookup uses Open Library. UPC/EAN lookup uses UPCItemDB trial lookup in this first phase and should be replaced or supplemented with a production provider before public release.

## eBay Seller Connection And Unpublished Offers

FlipTracker uses eBay's authorization-code consent flow. Seller access and refresh tokens stay in Convex and are never returned to the browser. The current private-beta gate uses a separate seller access key until full FlipTracker user authentication is implemented.

### 1. Create the eBay application

1. Sign in to the eBay Developers Program.
2. Create Sandbox keys first. Add Production keys only after the Sandbox workflow succeeds.
3. In the eBay OAuth settings, create or select a RuName.
4. Set the RuName's **Auth Accepted URL** to the Convex HTTP callback:

   ```text
   https://YOUR-CONVEX-DEPLOYMENT.convex.site/ebay/callback
   ```

5. Keep the RuName itself. `EBAY_RUNAME` is the eBay-generated RuName value, not the callback URL.

### 2. Configure Convex secrets

Run these from the project folder. Use Sandbox values initially and generate a strong, unique seller key.

```bash
npx convex env set EBAY_CLIENT_ID "YOUR_EBAY_CLIENT_ID"
npx convex env set EBAY_CLIENT_SECRET "YOUR_EBAY_CLIENT_SECRET"
npx convex env set EBAY_RUNAME "YOUR_EBAY_RUNAME"
npx convex env set EBAY_ENVIRONMENT "sandbox"
npx convex env set EBAY_APP_URL "http://localhost:5173/"
npx convex env set FLIPTRACKER_ADMIN_KEY "YOUR_LONG_RANDOM_SELLER_KEY"
```

For production, set the same variables on the production Convex deployment with Production eBay keys, `EBAY_ENVIRONMENT=production`, and the Vercel app URL for `EBAY_APP_URL`. Never use a `VITE_` prefix for eBay secrets.

### 3. Prepare the eBay seller account

1. Create payment, shipping/fulfillment, and return business policies in eBay.
2. Make sure the seller has an enabled inventory location.
3. Note the numeric eBay category IDs used for DVDs, Blu-rays, books, CDs, games, and other media. Category IDs can change, so FlipTracker stores these as seller settings instead of hard-coding them.

### 4. Connect and create a draft

1. Open **Listings** in FlipTracker.
2. Enter the private Seller Access Key and select **Load Setup**.
3. Select **Connect eBay**, sign in to the seller account, and approve access.
4. Load setup again, select the inventory location and business policies, enter media category IDs, and save.
5. Create internal eBay drafts from Inventory or Bulk Intake.
6. In Listings, select the queue and choose **Update Pricing**. Apply an approved price to each item you want to send.
7. Choose **Send to eBay Drafts** to create or refresh the selected unpublished offers.

FlipTracker continues through individual batch failures and leaves failed rows available for correction and retry. It does not call eBay's publish endpoint. Captured data-URL photos are not uploaded to eBay yet; review and add actual item photos before a future publish step.
