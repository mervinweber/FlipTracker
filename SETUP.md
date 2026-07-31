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

Vercel uses `npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL`. Configure two separate Vercel secrets with the same name:

- Production: a Convex **Production Deploy Key**, enabled only for Vercel Production.
- Preview: a Convex **Preview Deploy Key**, enabled only for Vercel Preview.

A feature-branch preview fails with "no Convex deployment configuration found" when only the Production key exists. Generate the Preview key from the Convex project's Settings page, add it directly in Vercel as `CONVEX_DEPLOY_KEY` for Preview, and redeploy the failed preview. Never reuse a development or production key for Preview.

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

1. Connect or reconnect the Sandbox seller after deploying this version. The consent must include inventory and account-policy access.
2. In **Listings > Seller Connection**, use **Create Sandbox Defaults** to create an enabled inventory location plus payment, Media Mail fulfillment, and 30-day return policies. Enter the Sandbox seller's postal code first.
3. If eBay reports that the Sandbox seller is not eligible for Business Policies, enable Business Policies for that test seller in eBay Sandbox and retry. Production seller policies should be reviewed and created in the seller account rather than generated automatically.
4. In Production, create and review the three business policies in eBay. If the connected account has no Inventory API location, FlipTracker displays **Create Inventory Location**. Enter the seller's postal code, country, a stable key, and a recognizable name; this creates an enabled warehouse without changing any policies.
5. Note the numeric eBay category IDs used for DVDs, Blu-rays, books, CDs, games, and other media. Category IDs can change, so FlipTracker stores these as seller settings instead of hard-coding them.

### 4. Connect and create a draft

1. Open **Listings** in FlipTracker.
2. Enter the private Seller Access Key and select **Load Setup**.
   On a private computer or phone, select **Remember on this device** before loading. FlipTracker will then restore Seller Connection automatically after refresh. The key is stored only in that browser and must be entered once on each device.
   After the connection is verified, FlipTracker hides the key and authorization controls. Use **Forget Device** to remove the stored key from that browser without revoking the server-side eBay authorization.
3. Select **Connect eBay**, sign in to the seller account, and approve access.
4. Load setup again. Create an inventory location if none exists, select the location and business policies, enter media category IDs, and save.
5. Scan a single item and leave **Add to eBay draft queue** selected, or use Bulk Intake to create internal eBay drafts for a stack.
6. In Listings, edit each draft that needs a different shipping policy or package preset. The fulfillment policy controls the buyer's shipping service and charge; package measurements support calculated or weight-aware shipping.
7. For new/sealed media, choose **eBay Catalog** and confirm the UPC/EAN/ISBN. Books with a metadata cover can use that stock cover during the beta. Used DVDs, Blu-rays, CDs, and games still require an actual item photo before eBay draft creation.
8. Select queue rows and choose **Find Fair Value**. FlipTracker retrieves active eBay asking prices, shows the range, median, shipping-aware median, match count, and confidence, then waits for approval. These are not sold comps.
9. Apply the approved prices and choose **Create eBay Drafts** to create or refresh the selected unpublished offers.

FlipTracker continues through individual batch failures and leaves failed rows available for correction and retry. Actual used-item photos are uploaded to eBay Picture Services when the draft is sent. Metadata stock covers are currently permitted for books; other used media requires an actual photo. FlipTracker does not call eBay's publish endpoint, so review every offer before publishing in Seller Hub.
