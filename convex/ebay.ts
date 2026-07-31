import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
].join(" ");

const EBAY_BROWSE_SCOPE = "https://api.ebay.com/oauth/api_scope";

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
type BrowseItem = {
  title?: string;
  itemWebUrl?: string;
  condition?: string;
  price?: { value?: string; currency?: string };
  shippingOptions?: Array<{ shippingCost?: { value?: string; currency?: string } }>;
};

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

async function applicationAccessToken() {
  const body = new URLSearchParams({ grant_type: "client_credentials", scope: EBAY_BROWSE_SCOPE });
  const response = await fetch(`${endpoints().api}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: basicAuthorization(), "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await responseBody(response);
  if (!response.ok) throw new Error(ebayError(data, response.status));
  const token = data as TokenResponse;
  if (!token.access_token) throw new Error("eBay did not return an application access token.");
  return token.access_token;
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

async function browseFetch(accessToken: string, params: URLSearchParams) {
  const response = await fetch(`${endpoints().api}/buy/browse/v1/item_summary/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
  });
  const body = await responseBody(response);
  if (!response.ok) throw new Error(ebayError(body, response.status));
  return (body as { itemSummaries?: BrowseItem[] } | undefined)?.itemSummaries ?? [];
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function moneyRound(value: number) {
  return Math.round(value * 100) / 100;
}

function suggestedListingPrice(value: number) {
  if (value <= 1) return moneyRound(value);
  return moneyRound(Math.max(0.99, Math.floor(value) + 0.99));
}

function normalizedWords(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((word) => word.length > 2);
}

function credibleBrowseItems(items: BrowseItem[], title: string) {
  const queryWords = new Set(normalizedWords(title));
  const queryAllowsLot = /\b(lot|bundle|case only|disc only)\b/i.test(title);
  return items.filter((item) => {
    const price = Number(item.price?.value);
    if (!Number.isFinite(price) || price <= 0 || !item.title) return false;
    if (!queryAllowsLot && /\b(lot of|bundle|case only|disc only|replacement case)\b/i.test(item.title)) return false;
    if (!queryWords.size) return true;
    const itemWords = new Set(normalizedWords(item.title));
    const overlap = [...queryWords].filter((word) => itemWords.has(word)).length;
    return overlap >= Math.max(1, Math.ceil(queryWords.size * 0.45));
  });
}

async function activePricingFor(accessToken: string, input: { title: string; barcode?: string; format?: string }) {
  const barcode = input.barcode?.replace(/\D/g, "") ?? "";
  const baseParams = { limit: "30", filter: "buyingOptions:{FIXED_PRICE}" };
  let query = barcode || [input.title, input.format].filter(Boolean).join(" ");
  let queryType = barcode ? "GTIN" : "Title";
  let items: BrowseItem[] = [];
  if ([8, 12, 13, 14].includes(barcode.length)) {
    items = await browseFetch(accessToken, new URLSearchParams({ ...baseParams, gtin: barcode }));
  }
  if (!items.length) {
    query = [input.title, input.format].filter(Boolean).join(" ");
    queryType = "Title";
    items = await browseFetch(accessToken, new URLSearchParams({ ...baseParams, q: query }));
  }
  const matches = credibleBrowseItems(items, input.title);
  if (!matches.length) {
    return { query, queryType, matchCount: 0, confidence: "Low", warning: "No credible active eBay matches were found." };
  }
  const itemPrices = matches.map((item) => Number(item.price?.value)).filter(Number.isFinite);
  const deliveredPrices = matches.map((item) => {
    const shipping = item.shippingOptions?.map((option) => Number(option.shippingCost?.value)).filter(Number.isFinite);
    return Number(item.price?.value) + (shipping?.length ? Math.min(...shipping) : 0);
  });
  const activeMedian = moneyRound(median(itemPrices));
  return {
    query,
    queryType,
    matchCount: matches.length,
    low: moneyRound(Math.min(...itemPrices)),
    median: activeMedian,
    high: moneyRound(Math.max(...itemPrices)),
    deliveredMedian: moneyRound(median(deliveredPrices)),
    suggestedPrice: suggestedListingPrice(activeMedian),
    confidence: matches.length >= 8 ? "High" : matches.length >= 3 ? "Medium" : "Low",
    source: `eBay Active Listings (${matches.length} matches)`,
    warning: matches.length < 3 ? "Fewer than three credible matches; verify before publishing." : undefined,
    samples: matches.slice(0, 3).map((item) => ({
      title: item.title || "eBay listing",
      price: moneyRound(Number(item.price?.value)),
      url: item.itemWebUrl,
    })),
  };
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

async function uploadPhotoBlob(accessToken: string, blob: Blob, filename: string) {
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

async function uploadActualPhoto(accessToken: string, dataUrl: string) {
  const { blob, filename } = dataUrlFile(dataUrl);
  return await uploadPhotoBlob(accessToken, blob, filename);
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
    const photos = asset ? await ctx.db.query("assetPhotos").withIndex("by_assetId", (q) => q.eq("assetId", asset._id)).collect() : [];
    return asset ? { listing, asset, photos: photos.sort((a, b) => a.position - b.position) } : null;
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
      const setupResults = await Promise.allSettled([
        ebayFetch(accessToken, `/sell/account/v1/fulfillment_policy?marketplace_id=${marketplace}`),
        ebayFetch(accessToken, `/sell/account/v1/payment_policy?marketplace_id=${marketplace}`),
        ebayFetch(accessToken, `/sell/account/v1/return_policy?marketplace_id=${marketplace}`),
        ebayFetch(accessToken, "/sell/inventory/v1/location?limit=100"),
      ]);
      const failedSetupRequest = setupResults.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failedSetupRequest) throw failedSetupRequest.reason;
      const [fulfillmentBody, paymentBody, returnBody, locationBody] = setupResults.map(
        (result) => (result as PromiseFulfilledResult<unknown>).value,
      );
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

export const lookupActivePricing = action({
  args: { adminKey: v.string(), listingIds: v.array(v.id("marketplaceListings")) },
  handler: async (ctx, args) => {
    requireAdminKey(args.adminKey);
    if (!args.listingIds.length) throw new Error("Select at least one listing to price.");
    if (args.listingIds.length > 25) throw new Error("Price up to 25 listings at a time.");
    const accessToken = await applicationAccessToken();
    const results = [];
    for (const listingId of args.listingIds) {
      const bundle = await ctx.runQuery(internal.ebay.getDraftBundle, { listingId });
      if (!bundle) {
        results.push({ listingId, matchCount: 0, confidence: "Low", warning: "Listing or inventory item was not found." });
        continue;
      }
      try {
        const summary = await activePricingFor(accessToken, {
          title: bundle.listing.title || bundle.asset.title,
          barcode: bundle.asset.upc || bundle.asset.barcode,
          format: bundle.asset.mediaFormat || bundle.asset.type,
        });
        results.push({ listingId, ...summary });
      } catch (error) {
        results.push({
          listingId,
          matchCount: 0,
          confidence: "Low",
          warning: error instanceof Error ? error.message : "eBay active pricing lookup failed.",
        });
      }
    }
    return results;
  },
});

export const createInventoryLocation = action({
  args: {
    adminKey: v.string(),
    postalCode: v.string(),
    country: v.string(),
    locationKey: v.string(),
    locationName: v.string(),
  },
  handler: async (ctx, args): Promise<{ locationKey: string; created: boolean }> => {
    requireAdminKey(args.adminKey);
    const postalCode = args.postalCode.trim();
    const country = args.country.trim().toUpperCase();
    const locationKey = args.locationKey.trim().replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 50);
    const locationName = args.locationName.trim().slice(0, 64);
    if (!postalCode) throw new Error("Enter the seller postal code.");
    if (!/^[A-Z]{2}$/.test(country)) throw new Error("Country must be a two-letter code such as US.");
    if (!locationKey || !locationName) throw new Error("Enter an inventory location key and name.");

    const accessToken = await refreshAccessToken(ctx);
    const locationsBody = await ebayFetch(accessToken, "/sell/inventory/v1/location?limit=100") as {
      locations?: Array<{ merchantLocationKey: string }>;
    };
    const exists = locationsBody.locations?.some((location) => location.merchantLocationKey === locationKey) ?? false;
    if (!exists) {
      await ebayFetch(accessToken, `/sell/inventory/v1/location/${encodeURIComponent(locationKey)}`, {
        method: "POST",
        body: JSON.stringify({
          location: { address: { postalCode, country } },
          locationTypes: ["WAREHOUSE"],
          name: locationName,
          merchantLocationStatus: "ENABLED",
        }),
      });
    }

    const settings = await ctx.runQuery(internal.ebay.getSettings, { singletonKey: singletonKey() });
    await ctx.runMutation(internal.ebay.saveSettingsRecord, {
      singletonKey: singletonKey(),
      environment: environment(),
      marketplaceId: settings?.marketplaceId ?? "EBAY_US",
      currency: settings?.currency ?? "USD",
      merchantLocationKey: locationKey,
      fulfillmentPolicyId: settings?.fulfillmentPolicyId,
      paymentPolicyId: settings?.paymentPolicyId,
      returnPolicyId: settings?.returnPolicyId,
      dvdCategoryId: settings?.dvdCategoryId,
      blurayCategoryId: settings?.blurayCategoryId,
      bookCategoryId: settings?.bookCategoryId,
      cdCategoryId: settings?.cdCategoryId,
      gameCategoryId: settings?.gameCategoryId,
      otherCategoryId: settings?.otherCategoryId,
    });
    return { locationKey, created: !exists };
  },
});

export const provisionSandboxDefaults = action({
  args: {
    adminKey: v.string(),
    postalCode: v.string(),
    country: v.string(),
    locationKey: v.string(),
    locationName: v.string(),
    mediaMailCost: v.number(),
  },
  handler: async (ctx, args) => {
    requireAdminKey(args.adminKey);
    if (environment() !== "sandbox") throw new Error("Automatic seller setup is limited to Sandbox.");
    const postalCode = args.postalCode.trim();
    const country = args.country.trim().toUpperCase();
    const locationKey = args.locationKey.trim().replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 50);
    const locationName = args.locationName.trim().slice(0, 64);
    if (!postalCode) throw new Error("Enter the Sandbox seller postal code.");
    if (!/^[A-Z]{2}$/.test(country)) throw new Error("Country must be a two-letter code such as US.");
    if (!locationKey || !locationName) throw new Error("Enter an inventory location key and name.");
    if (!Number.isFinite(args.mediaMailCost) || args.mediaMailCost < 0) throw new Error("Media Mail cost must be zero or higher.");

    const accessToken = await refreshAccessToken(ctx);
    const programsBody = await ebayFetch(accessToken, "/sell/account/v1/program/get_opted_in_programs") as { programs?: Array<{ programType?: string }> };
    const optedIn = programsBody.programs?.some((program) => program.programType === "SELLING_POLICY_MANAGEMENT");
    if (!optedIn) {
      try {
        await ebayFetch(accessToken, "/sell/account/v1/program/opt_in", {
          method: "POST",
          body: JSON.stringify({ programType: "SELLING_POLICY_MANAGEMENT" }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "eBay could not enable Business Policies.";
        throw new Error(`eBay Sandbox Account API could not enable Business Policies (${message}). Check https://developer.ebay.com/support/api-status for the unresolved Sandbox Account API incident, then retry Create Sandbox Defaults after eBay resolves it.`);
      }
    }

    const locationsBody = await ebayFetch(accessToken, "/sell/inventory/v1/location?limit=100") as { locations?: Array<{ merchantLocationKey: string }> };
    if (!locationsBody.locations?.some((location) => location.merchantLocationKey === locationKey)) {
      await ebayFetch(accessToken, `/sell/inventory/v1/location/${encodeURIComponent(locationKey)}`, {
        method: "POST",
        body: JSON.stringify({
          location: { address: { postalCode, country } },
          locationTypes: ["WAREHOUSE"],
          name: locationName,
          merchantLocationStatus: "ENABLED",
        }),
      });
    }

    const marketplace = "EBAY_US";
    const fulfillmentBody = await ebayFetch(accessToken, `/sell/account/v1/fulfillment_policy?marketplace_id=${marketplace}`) as { fulfillmentPolicies?: Array<{ fulfillmentPolicyId: string; name: string }> };
    const paymentBody = await ebayFetch(accessToken, `/sell/account/v1/payment_policy?marketplace_id=${marketplace}`) as { paymentPolicies?: Array<{ paymentPolicyId: string; name: string }> };
    const returnBody = await ebayFetch(accessToken, `/sell/account/v1/return_policy?marketplace_id=${marketplace}`) as { returnPolicies?: Array<{ returnPolicyId: string; name: string }> };

    let fulfillmentPolicyId = fulfillmentBody.fulfillmentPolicies?.[0]?.fulfillmentPolicyId;
    if (!fulfillmentPolicyId) {
      const created = await ebayFetch(accessToken, "/sell/account/v1/fulfillment_policy", {
        method: "POST",
        body: JSON.stringify({
          name: "FlipTracker Media Mail",
          description: "FlipTracker Sandbox default for books, movies, music, and games.",
          marketplaceId: marketplace,
          categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
          handlingTime: { value: 2, unit: "DAY" },
          shippingOptions: [{
            optionType: "DOMESTIC",
            costType: "FLAT_RATE",
            shippingServices: [{
              sortOrder: 1,
              shippingCarrierCode: "USPS",
              shippingServiceCode: "USPSMedia",
              shippingCost: { value: args.mediaMailCost.toFixed(2), currency: "USD" },
              additionalShippingCost: { value: "1.00", currency: "USD" },
              freeShipping: args.mediaMailCost === 0,
            }],
          }],
        }),
      }) as { fulfillmentPolicyId?: string };
      fulfillmentPolicyId = created.fulfillmentPolicyId;
    }

    let paymentPolicyId = paymentBody.paymentPolicies?.[0]?.paymentPolicyId;
    if (!paymentPolicyId) {
      const created = await ebayFetch(accessToken, "/sell/account/v1/payment_policy", {
        method: "POST",
        body: JSON.stringify({
          name: "FlipTracker Immediate Payment",
          marketplaceId: marketplace,
          categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
          immediatePay: true,
        }),
      }) as { paymentPolicyId?: string };
      paymentPolicyId = created.paymentPolicyId;
    }

    let returnPolicyId = returnBody.returnPolicies?.[0]?.returnPolicyId;
    if (!returnPolicyId) {
      const created = await ebayFetch(accessToken, "/sell/account/v1/return_policy", {
        method: "POST",
        body: JSON.stringify({
          name: "FlipTracker 30 Day Returns",
          marketplaceId: marketplace,
          categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
          returnsAccepted: true,
          returnPeriod: { value: 30, unit: "DAY" },
          refundMethod: "MONEY_BACK",
          returnShippingCostPayer: "BUYER",
        }),
      }) as { returnPolicyId?: string };
      returnPolicyId = created.returnPolicyId;
    }

    if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) throw new Error("eBay did not return all three policy IDs.");
    const settings = await ctx.runQuery(internal.ebay.getSettings, { singletonKey: singletonKey() });
    await ctx.runMutation(internal.ebay.saveSettingsRecord, {
      singletonKey: singletonKey(),
      environment: environment(),
      marketplaceId: settings?.marketplaceId ?? marketplace,
      currency: settings?.currency ?? "USD",
      merchantLocationKey: locationKey,
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
      dvdCategoryId: settings?.dvdCategoryId,
      blurayCategoryId: settings?.blurayCategoryId,
      bookCategoryId: settings?.bookCategoryId,
      cdCategoryId: settings?.cdCategoryId,
      gameCategoryId: settings?.gameCategoryId,
      otherCategoryId: settings?.otherCategoryId,
    });
    return { locationKey, fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
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
      const isBook = `${asset.type} ${asset.mediaFormat ?? ""}`.toLowerCase().includes("book");
      if (barcode) {
        const digits = barcode.replace(/\D/g, "");
        if (isBook) product.isbn = [barcode.replace(/[^0-9X]/gi, "").toUpperCase()];
        else if (digits.length === 13) product.ean = [digits];
        else product.upc = [digits];
      }
      const ebayCondition = conditionForEbay(listing.condition || asset.condition);
      const metadataCoverAllowed = isBook && Boolean(asset.coverImageUrl);
      const imageMode = listing.imageMode || (ebayCondition === "NEW" || metadataCoverAllowed ? "eBay Catalog" : "Actual Item Photo");
      let imageUrl: string | undefined;
      let imageFingerprint: string | undefined;
      let imageSource = "eBay catalog match";
      if (imageMode === "eBay Catalog") {
        if (metadataCoverAllowed) {
          imageUrl = asset.coverImageUrl;
          product.imageUrls = [imageUrl];
          imageSource = "Metadata stock cover";
        } else {
          if (ebayCondition !== "NEW") throw new Error("Used discs require an actual item photo. Books with a metadata cover may use that stock image.");
          if (!barcode) throw new Error("A UPC, EAN, or ISBN is required for eBay catalog photo matching.");
        }
      } else {
        if (bundle.photos.length) {
          const imageUrls: string[] = [];
          for (const [index, photo] of bundle.photos.slice(0, 12).entries()) {
            let uploadedUrl = photo.ebayImageUrl;
            if (!uploadedUrl) {
              const blob = await ctx.storage.get(photo.storageId);
              if (!blob) throw new Error(`Photo ${index + 1} is missing from storage. Remove it and capture it again.`);
              uploadedUrl = await uploadPhotoBlob(accessToken, blob, photo.filename || `fliptracker-${index + 1}.jpg`);
              await ctx.runMutation(internal.photos.markEbayUploaded, { photoId: photo._id, ebayImageUrl: uploadedUrl });
            }
            imageUrls.push(uploadedUrl);
          }
          if (!imageUrls.length) throw new Error("Add at least one actual item photo before sending this draft.");
          product.imageUrls = imageUrls;
          imageUrl = imageUrls[0];
          imageFingerprint = await sha256(bundle.photos.map((photo) => `${photo._id}:${photo.storageId}`).join("|"));
          imageSource = `Actual item photos (${imageUrls.length})`;
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
          imageSource = "Actual item photo (legacy)";
        }
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
