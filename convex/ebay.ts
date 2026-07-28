import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
].join(" ");

type EbayEnvironment = "sandbox" | "production";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
};

type Policy = { id: string; name: string };
type Location = { key: string; name: string };

function environment(): EbayEnvironment {
  return process.env.EBAY_ENVIRONMENT?.toLowerCase() === "production" ? "production" : "sandbox";
}

function singletonKey() {
  return `seller:${environment()}`;
}

function endpoints() {
  const isProduction = environment() === "production";
  return {
    api: isProduction ? "https://api.ebay.com" : "https://api.sandbox.ebay.com",
    media: isProduction ? "https://apim.ebay.com" : "https://apim.sandbox.ebay.com",
    auth: isProduction ? "https://auth.ebay.com/oauth2/authorize" : "https://auth.sandbox.ebay.com/oauth2/authorize",
  };
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured in Convex.`);
  return value;
}

function requireAdminKey(adminKey: string) {
  const expected = requiredEnv("FLIPTRACKER_ADMIN_KEY");
  if (!adminKey || adminKey !== expected) throw new Error("Seller access key is incorrect.");
}

function basicAuthorization() {
  return `Basic ${btoa(`${requiredEnv("EBAY_CLIENT_ID")}:${requiredEnv("EBAY_CLIENT_SECRET")}`)}`;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function responseBody(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function ebayError(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const record = body as { errors?: Array<{ message?: string; longMessage?: string }>; error_description?: string };
    const detail = record.errors?.map((error) => error.longMessage || error.message).filter(Boolean).join(" ");
    if (detail) return detail;
    if (record.error_description) return record.error_description;
  }
  return `eBay request failed (${status}).`;
}

async function ebayFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${endpoints().api}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Content-Language": "en-US",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      ...init.headers,
    },
  });
  const body = await responseBody(response);
  if (!response.ok) throw new Error(ebayError(body, response.status));
  return body;
}

function dataUrlFile(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|gif|bmp|tiff|webp|avif|heic));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("The actual item photo is not a supported image. Capture or upload it again.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const extension = match[1] === "image/jpeg" ? "jpg" : match[1].slice("image/".length);
  return { blob: new Blob([bytes], { type: match[1] }), filename: `fliptracker-item.${extension}` };
}

async function uploadActualPhoto(accessToken: string, dataUrl: string) {
  const { blob, filename } = dataUrlFile(dataUrl);
  const form = new FormData();
  form.append("image", blob, filename);
  const response = await fetch(`${endpoints().media}/commerce/media/v1_beta/image/create_image_from_file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Language": "en-US",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
    body: form,
  });
  const body = await responseBody(response);
  if (!response.ok) throw new Error(ebayError(body, response.status));
  const imageUrl = (body as { imageUrl?: string } | undefined)?.imageUrl;
  if (!imageUrl) throw new Error("eBay accepted the photo but did not return its Picture Services URL.");
  return imageUrl;
}

async function refreshAccessToken(ctx: ActionCtx) {
  const connection = await ctx.runQuery(internal.ebay.getConnection, { singletonKey: singletonKey() });
  if (!connection) throw new Error("Connect an eBay seller account first.");
  if (connection.accessTokenExpiresAt > Date.now() + 300_000) return connection.accessToken;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
    scope: EBAY_SCOPES,
  });
  const response = await fetch(`${endpoints().api}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthorization(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await responseBody(response);
  if (!response.ok) throw new Error(ebayError(data, response.status));
  const token = data as TokenResponse;
  await ctx.runMutation(internal.ebay.updateAccessToken, {
    singletonKey: singletonKey(),
    accessToken: token.access_token,
    accessTokenExpiresAt: Date.now() + token.expires_in * 1000,
    scopes: token.scope,
  });
  return token.access_token;
}

function parseItemSpecifics(value?: string) {
  const aspects: Record<string, string[]> = {};
  for (const line of value?.split("\n") ?? []) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    const itemValue = line.slice(separator + 1).trim();
    if (name && itemValue) aspects[name] = [itemValue];
  }
  return aspects;
}

function conditionForEbay(condition?: string) {
  const normalized = condition?.trim().toLowerCase() ?? "";
  if (["new", "brand new", "sealed"].includes(normalized)) return "NEW";
  if (normalized.includes("like new")) return "LIKE_NEW";
  if (normalized.includes("very good")) return "VERY_GOOD";
  if (normalized.includes("acceptable")) return "ACCEPTABLE";
  if (normalized.includes("parts")) return "FOR_PARTS_OR_NOT_WORKING";
  return "GOOD";
}

function categoryForAsset(
  listing: { ebayCategoryId?: string },
  asset: { type?: string; mediaFormat?: string },
  settings: {
    dvdCategoryId?: string;
    blurayCategoryId?: string;
    bookCategoryId?: string;
    cdCategoryId?: string;
    gameCategoryId?: string;
    otherCategoryId?: string;
  } | null,
) {
  if (listing.ebayCategoryId) return listing.ebayCategoryId;
  const format = `${asset.mediaFormat ?? ""} ${asset.type ?? ""}`.toLowerCase();
  if (format.includes("blu")) return settings?.blurayCategoryId;
  if (format.includes("dvd")) return settings?.dvdCategoryId;
  if (format.includes("book")) return settings?.bookCategoryId;
  if (format.includes("cd") || format.includes("music")) return settings?.cdCategoryId;
  if (format.includes("game")) return settings?.gameCategoryId;
  return settings?.otherCategoryId;
}

function validatedCategoryId(categoryId?: string) {
  if (!categoryId) return undefined;
  const normalized = categoryId.trim();
  if (!/^\d+$/.test(normalized)) throw new Error(`eBay category ID "${categoryId}" must contain numbers only.`);
  return normalized;
}

function safeReturnUrl(candidate?: string) {
  const configured = new URL(requiredEnv("EBAY_APP_URL"));
  if (!candidate) return configured.toString();
  try {
    const requested = new URL(candidate);
    return requested.origin === configured.origin ? requested.toString() : configured.toString();
  } catch {
    return configured.toString();
  }
}

export const getConnection = internalQuery({
  args: { singletonKey: v.string() },
  handler: async (ctx, args) =>
    await ctx.db.query("ebayConnections").withIndex("by_singletonKey", (q) => q.eq("singletonKey", args.singletonKey)).unique(),
});

export const getSettings = internalQuery({
  args: { singletonKey: v.string() },
  handler: async (ctx, args) =>
    await ctx.db.query("ebaySettings").withIndex("by_singletonKey", (q) => q.eq("singletonKey", args.singletonKey)).unique(),
});

export const getDraftBundle = internalQuery({
  args: { listingId: v.id("marketplaceListings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) return null;
    const asset = await ctx.db.get(listing.assetId);
    return asset ? { listing, asset } : null;
  },
});

export const saveOauthState = internalMutation({
  args: {
    stateHash: v.string(),
    environment: v.string(),
    returnUrl: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("ebayOauthStates", { ...args, createdAt: Date.now() });
  },
});

export const consumeOauthState = internalMutation({
  args: { stateHash: v.string() },
  handler: async (ctx, args) => {
    const state = await ctx.db.query("ebayOauthStates").withIndex("by_stateHash", (q) => q.eq("stateHash", args.stateHash)).unique();
    if (!state) return null;
    await ctx.db.delete(state._id);
    if (state.expiresAt < Date.now()) return null;
    return state;
  },
});

export const saveConnection = internalMutation({
  args: {
    singletonKey: v.string(),
    environment: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    scopes: v.string(),
    accessTokenExpiresAt: v.number(),
    refreshTokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("ebayConnections").withIndex("by_singletonKey", (q) => q.eq("singletonKey", args.singletonKey)).unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("ebayConnections", { ...args, connectedAt: now, updatedAt: now });
  },
});

export const updateAccessToken = internalMutation({
  args: {
    singletonKey: v.string(),
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
    scopes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db.query("ebayConnections").withIndex("by_singletonKey", (q) => q.eq("singletonKey", args.singletonKey)).unique();
    if (!connection) throw new Error("eBay connection not found.");
    await ctx.db.patch(connection._id, {
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      scopes: args.scopes ?? connection.scopes,
      updatedAt: Date.now(),
    });
  },
});

export const saveSettingsRecord = internalMutation({
  args: {
    singletonKey: v.string(),
    environment: v.string(),
    marketplaceId: v.string(),
    currency: v.string(),
    merchantLocationKey: v.optional(v.string()),
    fulfillmentPolicyId: v.optional(v.string()),
    paymentPolicyId: v.optional(v.string()),
    returnPolicyId: v.optional(v.string()),
    dvdCategoryId: v.optional(v.string()),
    blurayCategoryId: v.optional(v.string()),
    bookCategoryId: v.optional(v.string()),
    cdCategoryId: v.optional(v.string()),
    gameCategoryId: v.optional(v.string()),
    otherCategoryId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("ebaySettings").withIndex("by_singletonKey", (q) => q.eq("singletonKey", args.singletonKey)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("ebaySettings", { ...args, updatedAt: Date.now() });
  },
});

export const markDraftCreated = internalMutation({
  args: {
    listingId: v.id("marketplaceListings"),
    sku: v.string(),
    offerId: v.string(),
    categoryId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageFingerprint: v.optional(v.string()),
    imageSource: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.listingId, {
      sku: args.sku,
      ebayInventorySku: args.sku,
      ebayOfferId: args.offerId,
      ebayCategoryId: args.categoryId,
      ebayImageUrl: args.imageUrl,
      ebayImageFingerprint: args.imageFingerprint,
      ebayImageSource: args.imageSource,
      ebayDraftStatus: "Unpublished offer",
      ebayDraftCreatedAt: Date.now(),
      ebayLastError: undefined,
      pricingStatus: "eBay Draft Created",
      updatedAt: Date.now(),
    });
  },
});

export const markDraftError = internalMutation({
  args: { listingId: v.id("marketplaceListings"), message: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.listingId, { ebayLastError: args.message, updatedAt: Date.now() });
  },
});

export const saveUploadedImage = internalMutation({
  args: {
    listingId: v.id("marketplaceListings"),
    imageUrl: v.string(),
    imageFingerprint: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.listingId, {
      ebayImageUrl: args.imageUrl,
      ebayImageFingerprint: args.imageFingerprint,
      ebayImageSource: "Actual item photo",
      updatedAt: Date.now(),
    });
  },
});

export const beginOauth = action({
  args: { adminKey: v.string(), returnUrl: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ authorizationUrl: string; callbackUrl: string }> => {
    requireAdminKey(args.adminKey);
    const state = randomState();
    const callbackUrl = `${requiredEnv("CONVEX_SITE_URL")}/ebay/callback`;
    const returnUrl = safeReturnUrl(args.returnUrl);
    await ctx.runMutation(internal.ebay.saveOauthState, {
      stateHash: await sha256(state),
      environment: environment(),
      returnUrl,
      expiresAt: Date.now() + 10 * 60_000,
    });
    const params = new URLSearchParams({
      client_id: requiredEnv("EBAY_CLIENT_ID"),
      redirect_uri: requiredEnv("EBAY_RUNAME"),
      response_type: "code",
      scope: EBAY_SCOPES,
      state,
    });
    return { authorizationUrl: `${endpoints().auth}?${params.toString()}`, callbackUrl };
  },
});

export const loadSetup = action({
  args: { adminKey: v.string() },
  handler: async (ctx, args): Promise<{
    connected: boolean;
    environment: EbayEnvironment;
    connectedAt?: number;
    settings: Record<string, string | undefined>;
    policies: { fulfillment: Policy[]; payment: Policy[]; returns: Policy[] };
    locations: Location[];
    warning?: string;
  }> => {
    requireAdminKey(args.adminKey);
    const connection = await ctx.runQuery(internal.ebay.getConnection, { singletonKey: singletonKey() });
    const settings = await ctx.runQuery(internal.ebay.getSettings, { singletonKey: singletonKey() });
    const base = {
      connected: Boolean(connection),
      environment: environment(),
      connectedAt: connection?.connectedAt,
      settings: {
        marketplaceId: settings?.marketplaceId ?? "EBAY_US",
        currency: settings?.currency ?? "USD",
        merchantLocationKey: settings?.merchantLocationKey,
        fulfillmentPolicyId: settings?.fulfillmentPolicyId,
        paymentPolicyId: settings?.paymentPolicyId,
        returnPolicyId: settings?.returnPolicyId,
        dvdCategoryId: settings?.dvdCategoryId,
        blurayCategoryId: settings?.blurayCategoryId,
        bookCategoryId: settings?.bookCategoryId,
        cdCategoryId: settings?.cdCategoryId,
        gameCategoryId: settings?.gameCategoryId,
        otherCategoryId: settings?.otherCategoryId,
      },
      policies: { fulfillment: [] as Policy[], payment: [] as Policy[], returns: [] as Policy[] },
      locations: [] as Location[],
    };
    if (!connection) return base;

    try {
      const accessToken = await refreshAccessToken(ctx);
      const marketplace = encodeURIComponent(settings?.marketplaceId ?? "EBAY_US");
      const [fulfillmentBody, paymentBody, returnBody, locationBody] = await Promise.all([
        ebayFetch(accessToken, `/sell/account/v1/fulfillment_policy?marketplace_id=${marketplace}`),
        ebayFetch(accessToken, `/sell/account/v1/payment_policy?marketplace_id=${marketplace}`),
        ebayFetch(accessToken, `/sell/account/v1/return_policy?marketplace_id=${marketplace}`),
        ebayFetch(accessToken, "/sell/inventory/v1/location?limit=100"),
      ]);
      const fulfillment = (fulfillmentBody as { fulfillmentPolicies?: Array<{ fulfillmentPolicyId: string; name: string }> })?.fulfillmentPolicies ?? [];
      const payment = (paymentBody as { paymentPolicies?: Array<{ paymentPolicyId: string; name: string }> })?.paymentPolicies ?? [];
      const returns = (returnBody as { returnPolicies?: Array<{ returnPolicyId: string; name: string }> })?.returnPolicies ?? [];
      const locations = (locationBody as { locations?: Array<{ merchantLocationKey: string; name?: string }> })?.locations ?? [];
      return {
        ...base,
        policies: {
          fulfillment: fulfillment.map((policy) => ({ id: policy.fulfillmentPolicyId, name: policy.name })),
          payment: payment.map((policy) => ({ id: policy.paymentPolicyId, name: policy.name })),
          returns: returns.map((policy) => ({ id: policy.returnPolicyId, name: policy.name })),
        },
        locations: locations.map((location) => ({ key: location.merchantLocationKey, name: location.name || location.merchantLocationKey })),
      };
    } catch (error) {
      return { ...base, warning: error instanceof Error ? error.message : "Could not load eBay account settings." };
    }
  },
});

export const saveSettings = action({
  args: {
    adminKey: v.string(),
    marketplaceId: v.string(),
    currency: v.string(),
    merchantLocationKey: v.optional(v.string()),
    fulfillmentPolicyId: v.optional(v.string()),
    paymentPolicyId: v.optional(v.string()),
    returnPolicyId: v.optional(v.string()),
    dvdCategoryId: v.optional(v.string()),
    blurayCategoryId: v.optional(v.string()),
    bookCategoryId: v.optional(v.string()),
    cdCategoryId: v.optional(v.string()),
    gameCategoryId: v.optional(v.string()),
    otherCategoryId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    requireAdminKey(args.adminKey);
    const { adminKey: _adminKey, ...settings } = args;
    await ctx.runMutation(internal.ebay.saveSettingsRecord, {
      ...settings,
      singletonKey: singletonKey(),
      environment: environment(),
    });
    return { ok: true };
  },
});

export const createUnpublishedOffer = action({
  args: { adminKey: v.string(), listingId: v.id("marketplaceListings") },
  handler: async (ctx, args): Promise<{ offerId: string; sku: string; updated: boolean }> => {
    requireAdminKey(args.adminKey);
    const bundle = await ctx.runQuery(internal.ebay.getDraftBundle, { listingId: args.listingId });
    if (!bundle) throw new Error("Listing or inventory item not found.");
    const { listing, asset } = bundle;
    if (listing.platform.toLowerCase() !== "ebay") throw new Error("Only eBay listings can be sent to eBay.");
    const price = listing.currentPrice ?? listing.listedPrice;
    if (!price || price <= 0) throw new Error("Add a listing price before creating the eBay draft.");
    if (!listing.title.trim()) throw new Error("Add a listing title before creating the eBay draft.");

    try {
      const accessToken = await refreshAccessToken(ctx);
      const settings = await ctx.runQuery(internal.ebay.getSettings, { singletonKey: singletonKey() });
      if (!settings?.merchantLocationKey) throw new Error("Choose an eBay inventory location in Seller Connection.");
      const fulfillmentPolicyId = listing.fulfillmentPolicyId || settings.fulfillmentPolicyId;
      if (!fulfillmentPolicyId) throw new Error("Choose an eBay shipping policy before sending this draft.");
      if (!settings.paymentPolicyId) throw new Error("Choose an eBay payment policy in Seller Connection.");
      if (!settings.returnPolicyId) throw new Error("Choose an eBay return policy in Seller Connection.");
      const sku = (listing.sku || `FT-${asset._id}`).slice(0, 50);
      const categoryId = validatedCategoryId(categoryForAsset(listing, asset, settings));
      const aspects = parseItemSpecifics(listing.itemSpecifics);
      if (asset.mediaFormat) aspects.Format ??= [asset.mediaFormat];
      if (asset.studio) aspects.Studio ??= [asset.studio];
      if (asset.releaseYear) aspects["Release Year"] ??= [asset.releaseYear];
      if (asset.rating) aspects.Rating ??= [asset.rating];

      const product: Record<string, unknown> = {
        title: listing.title.trim().slice(0, 80),
        description: listing.description?.trim() || listing.title.trim(),
        aspects,
      };
      const barcode = asset.upc || asset.barcode;
      if (barcode) {
        const isBook = `${asset.type} ${asset.mediaFormat ?? ""}`.toLowerCase().includes("book");
        const digits = barcode.replace(/\D/g, "");
        if (isBook) product.isbn = [barcode.replace(/[^0-9X]/gi, "").toUpperCase()];
        else if (digits.length === 13) product.ean = [digits];
        else product.upc = [digits];
      }
      const ebayCondition = conditionForEbay(listing.condition || asset.condition);
      const imageMode = listing.imageMode || (ebayCondition === "NEW" ? "eBay Catalog" : "Actual Item Photo");
      let imageUrl: string | undefined;
      let imageFingerprint: string | undefined;
      let imageSource = "eBay catalog match";
      if (imageMode === "eBay Catalog") {
        if (ebayCondition !== "NEW") throw new Error("eBay does not allow stock or catalog photos for used items. Add an actual item photo.");
        if (!barcode) throw new Error("A UPC, EAN, or ISBN is required for eBay catalog photo matching.");
      } else {
        if (!asset.photoDataUrl) throw new Error("Used items require an actual item photo before they can be sent to eBay.");
        imageFingerprint = await sha256(asset.photoDataUrl);
        imageUrl = listing.ebayImageFingerprint === imageFingerprint ? listing.ebayImageUrl : undefined;
        if (!imageUrl) {
          imageUrl = await uploadActualPhoto(accessToken, asset.photoDataUrl);
          await ctx.runMutation(internal.ebay.saveUploadedImage, {
            listingId: listing._id,
            imageUrl,
            imageFingerprint,
          });
        }
        product.imageUrls = [imageUrl];
        imageSource = "Actual item photo";
      }

      const inventoryItem: Record<string, unknown> = {
        availability: { shipToLocationAvailability: { quantity: 1 } },
        condition: ebayCondition,
        product,
      };
      if (listing.packageWeightOz !== undefined) {
        if (!Number.isFinite(listing.packageWeightOz) || listing.packageWeightOz <= 0) throw new Error("Package weight must be above zero.");
        const packageWeightAndSize: Record<string, unknown> = {
          weight: { value: listing.packageWeightOz, unit: "OUNCE" },
        };
        if (listing.packageType) packageWeightAndSize.packageType = listing.packageType;
        const dimensions = [listing.packageLengthIn, listing.packageWidthIn, listing.packageHeightIn];
        if (dimensions.some((value) => value !== undefined)) {
          if (dimensions.some((value) => value === undefined || !Number.isFinite(value) || value <= 0)) {
            throw new Error("Enter package length, width, and height together, all above zero.");
          }
          packageWeightAndSize.dimensions = {
            length: listing.packageLengthIn,
            width: listing.packageWidthIn,
            height: listing.packageHeightIn,
            unit: "INCH",
          };
        }
        inventoryItem.packageWeightAndSize = packageWeightAndSize;
      }

      await ebayFetch(accessToken, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
        method: "PUT",
        body: JSON.stringify(inventoryItem),
      });

      const offer: Record<string, unknown> = {
        sku,
        marketplaceId: settings?.marketplaceId ?? "EBAY_US",
        format: "FIXED_PRICE",
        availableQuantity: 1,
        pricingSummary: { price: { value: price.toFixed(2), currency: settings?.currency ?? "USD" } },
      };
      if (categoryId) offer.categoryId = categoryId;
      offer.merchantLocationKey = settings.merchantLocationKey;
      const policies: Record<string, string> = {};
      policies.fulfillmentPolicyId = fulfillmentPolicyId;
      policies.paymentPolicyId = settings.paymentPolicyId;
      policies.returnPolicyId = settings.returnPolicyId;
      offer.listingPolicies = policies;

      let offerId = listing.ebayOfferId;
      const updated = Boolean(offerId);
      if (offerId) {
        const { sku: _sku, marketplaceId: _marketplaceId, format: _format, ...offerPatch } = offer;
        await ebayFetch(accessToken, `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
          method: "PUT",
          body: JSON.stringify(offerPatch),
        });
      } else {
        const result = await ebayFetch(accessToken, "/sell/inventory/v1/offer", {
          method: "POST",
          body: JSON.stringify(offer),
        }) as { offerId?: string };
        offerId = result?.offerId;
      }
      if (!offerId) throw new Error("eBay did not return an offer ID.");
      await ctx.runMutation(internal.ebay.markDraftCreated, {
        listingId: args.listingId,
        sku,
        offerId,
        categoryId,
        imageUrl,
        imageFingerprint,
        imageSource,
      });
      return { offerId, sku, updated };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create the eBay draft.";
      await ctx.runMutation(internal.ebay.markDraftError, { listingId: args.listingId, message });
      throw new Error(message);
    }
  },
});
