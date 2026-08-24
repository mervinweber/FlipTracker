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

For the v0.9 authenticated beta, also set `VITE_CLERK_PUBLISHABLE_KEY`. Follow the ordered rollout in `docs/V0.9_RELEASE_PLAN.md`; do not enable required auth before assigning the existing records to the first owner.

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

## v0.9 Authentication

Authentication remains opt-in until the production owner migration is complete. The application uses its current private single-seller behavior when `VITE_CLERK_PUBLISHABLE_KEY` is absent.

1. Create the Clerk app and Convex JWT integration.
2. Set `CLERK_JWT_ISSUER_DOMAIN` in Convex development and production.
3. Copy `docs/snippets/convex-auth.config.ts.txt` to `convex/auth.config.ts`.
4. Set `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local` and Vercel.
5. Deploy, sign in as the owner, and use **Assign Existing Data** once.
6. Verify two-account isolation.
7. Set `FLIPTRACKER_AUTH_REQUIRED=true` in Convex development and production.

See `docs/V0.9_RELEASE_PLAN.md` for commands, release gates, and rollback preparation.

The inventory table, dashboard cards, add/edit/delete actions, and Excel import now use Convex. Excel export still runs in the browser from the current Convex query result.


## Barcode Scanning

The media scanner uses the phone camera through the browser. Camera access requires HTTPS in production or `localhost` for local testing. If camera permissions fail, use the manual UPC/EAN/ISBN entry field.

Metadata lookup is handled by Convex actions. ISBN/book lookup uses Open Library with ISBN-10/ISBN-13 alias and search fallbacks. An optional Google Books fallback can fill missing book metadata and cover images. UPC/EAN lookup uses UPCItemDB trial lookup in this first phase and should be replaced or supplemented with a production provider before public release.

To enable the Google Books fallback, enable the Books API for a Google Cloud project, create a restricted API key, and store it only in Convex:

```bash
npx convex env set GOOGLE_BOOKS_API_KEY "YOUR_GOOGLE_BOOKS_API_KEY"
npx convex env set --prod GOOGLE_BOOKS_API_KEY "YOUR_GOOGLE_BOOKS_API_KEY"
```

Restrict the key to the Google Books API. Do not put this key in Vercel or a `VITE_` environment variable. The app continues using Open Library when the optional key is absent.

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

### AI listing descriptions

The one-click description generator runs from Convex so provider keys are never sent to the browser. Gemini is the recommended free beta provider:

```bash
npx convex env set GEMINI_API_KEY "YOUR_GEMINI_API_KEY"
npx convex env set AI_DESCRIPTION_PROVIDER "gemini"
```

`GEMINI_DESCRIPTION_MODEL` is optional; FlipTracker defaults to the free-tier-compatible `gemini-2.5-flash-lite`. When `AI_DESCRIPTION_PROVIDER` is omitted, FlipTracker chooses Gemini when `GEMINI_API_KEY` exists, then falls back to OpenAI when `OPENAI_API_KEY` exists.

OpenAI remains available as an optional provider:

```bash
npx convex env set OPENAI_API_KEY "YOUR_OPENAI_API_KEY"
npx convex env set AI_DESCRIPTION_PROVIDER "openai"
```

For production, select the production deployment in the Convex dashboard and add the same values under **Settings > Environment Variables**. Do not put either provider key in Vercel or use a `VITE_` prefix. Gemini free-tier prompts may be used by Google to improve its products, so FlipTracker filters internal notes down to buyer-relevant condition language before sending them.

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
7. For new/sealed media, choose **eBay Catalog** and confirm the UPC/EAN/ISBN. Books with a metadata cover can use catalog matching during the beta; FlipTracker sends the ISBN and lets eBay attach its catalog image when a match exists. Used DVDs, Blu-rays, CDs, and games still require an actual item photo before eBay draft creation.
8. Select queue rows and choose **Find Fair Value**. FlipTracker retrieves active eBay asking prices, shows the range, median, shipping-aware median, match count, and confidence, then waits for approval. These are not sold comps.
9. Apply the approved prices and choose **Stage with eBay** to create or refresh selected unpublished Inventory API offers. These API offers do not appear in Seller Hub Drafts.
10. Review the staged item in FlipTracker, then use its **Publish to eBay** action. Confirming this action creates the live, buyer-visible eBay listing.

Legacy records without package measurements receive a submission default of 16 oz for a book, 8 oz for a DVD/Blu-ray/game, or 6 oz for a CD. These defaults satisfy eBay shipping validation but should be replaced with the packed item's measured weight whenever shipping charges depend on weight.

Do not use eBay Standard Envelope for books, DVDs, Blu-rays, or CDs; it is limited to eligible thin items weighing no more than 3 oz. Use **Create/Select Media Mail** in Seller Connection, or **Use Media Mail** while editing an eligible listing. Save the listing before publishing. Video games are not USPS Media Mail eligible and need a separate Ground Advantage or other parcel policy.

Each eBay synchronization sends quantity `1` as both total ship-to-home availability and availability at the selected inventory location. This preserves stock availability when eBay's replace-inventory endpoint refreshes an existing staged offer.

Listing photos can be managed from either **Photo Queue** or **Listings → Edit → Shipping & Photos**. Both views attach photos to the same inventory copy, preserve primary-first order, and enforce eBay's 12-photo maximum. Stage the offer again after changing photos so eBay receives the updated set.

FlipTracker continues through individual batch failures and leaves failed rows available for correction and retry. Actual used-item photos are uploaded to eBay Picture Services when the offer is staged. Books can request an eBay catalog match by ISBN; other used media requires an actual photo. Publishing is always a separate, confirmation-protected action.
