import { ConvexError, v } from "convex/values";
import { XMLParser } from "fast-xml-parser";
import type { ActionCtx } from "./_generated/server";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
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
type SellerListingSummary = {
  activeCount: number;
  scheduledCount: number;
  checkedAt: number;
};
type EbayAmount = { value?: string; currency?: string };
type EbayOrderLineItem = {
  legacyItemId?: string;
  sku?: string;
  title?: string;
  quantity?: number;
  lineItemCost?: EbayAmount;
  discountedLineItemCost?: EbayAmount;
};
type EbayOrder = {
  orderId?: string;
  creationDate?: string;
  orderPaymentStatus?: string;
  cancelStatus?: { cancelState?: string };
  buyer?: { username?: string };
  lineItems?: EbayOrderLineItem[];
  pricingSummary?: { deliveryCost?: EbayAmount };
  totalMarketplaceFee?: EbayAmount;
};
type BrowseItem = {
  title?: string;
  itemWebUrl?: string;
  condition?: string;
  price?: { value?: string; currency?: string };
  shippingOptions?: Array<{ shippingCost?: { value?: string; currency?: string } }>;
};
type TaxonomyCategory = { categoryId?: string; categoryName?: string };
type TaxonomyAncestor = TaxonomyCategory & { categoryTreeNodeLevel?: number };
type TaxonomySuggestion = {
  category?: TaxonomyCategory;
  categoryTreeNodeAncestors?: TaxonomyAncestor[];
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

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
    const record = body as {
      errors?: Array<{
        errorId?: number;
        message?: string;
        longMessage?: string;
        parameters?: Array<{ name?: string; value?: string }>;
      }>;
      error_description?: string;
    };
    const detail = record.errors?.map((error) => {
      const message = error.longMessage || error.message;
      const parameters = error.parameters
        ?.map((parameter) => [parameter.name, parameter.value].filter(Boolean).join("="))
        .filter(Boolean)
        .join(", ");
      return [message, error.errorId ? `(eBay ${error.errorId})` : undefined, parameters ? `[${parameters}]` : undefined]
        .filter(Boolean)
        .join(" ");
    }).filter(Boolean).join(" ");
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

async function tradingApiFetch(accessToken: string, callName: string, requestXml: string) {
  const response = await fetch(`${endpoints().api}/ws/api.dll`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1423",
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-IAF-TOKEN": accessToken,
    },
    body: requestXml,
  });
  const text = await response.text();
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: true }).parse(text) as Record<string, unknown>;
  const result = parsed[`${callName}Response`] as {
    Ack?: string;
    Errors?: { LongMessage?: string; ShortMessage?: string } | Array<{ LongMessage?: string; ShortMessage?: string }>;
  } | undefined;
  const errors = result?.Errors ? (Array.isArray(result.Errors) ? result.Errors : [result.Errors]) : [];
  if (!response.ok || !result || result.Ack === "Failure" || result.Ack === "PartialFailure") {
    const detail = errors.map((error) => error.LongMessage || error.ShortMessage).filter(Boolean).join(" ");
    throw new Error(detail || `eBay ${callName} request failed (${response.status}).`);
  }
  return result;
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

export const suggestCategories = action({
  args: {
    query: v.string(),
    marketplaceId: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<
    | { ok: true; suggestions: Array<{ categoryId: string; categoryName: string; categoryPath: string }> }
    | { ok: false; error: string }
  > => {
    const query = args.query.trim().replace(/\s+/g, " ").slice(0, 350);
    if (query.length < 3) return { ok: false, error: "Enter at least three characters to search eBay categories." };
    if (environment() !== "production") {
      return { ok: false, error: "eBay category suggestions require the Production eBay configuration; Sandbox returns unreliable category data." };
    }

    try {
      const accessToken = await applicationAccessToken();
      const marketplaceId = args.marketplaceId?.trim() || "EBAY_US";
      const tree = await ebayFetch(
        accessToken,
        `/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${encodeURIComponent(marketplaceId)}`,
      ) as { categoryTreeId?: string };
      if (!tree.categoryTreeId) throw new Error("eBay did not return a category tree for this marketplace.");

      const response = await ebayFetch(
        accessToken,
        `/commerce/taxonomy/v1/category_tree/${encodeURIComponent(tree.categoryTreeId)}/get_category_suggestions?q=${encodeURIComponent(query)}`,
      ) as { categorySuggestions?: TaxonomySuggestion[] };

      const suggestions = (response.categorySuggestions ?? []).flatMap((suggestion) => {
        const categoryId = suggestion.category?.categoryId?.trim();
        const categoryName = suggestion.category?.categoryName?.trim();
        if (!categoryId || !categoryName) return [];
        const ancestors = [...(suggestion.categoryTreeNodeAncestors ?? [])]
          .filter((ancestor) => ancestor.categoryName && ancestor.categoryId !== tree.categoryTreeId)
          .sort((left, right) => (left.categoryTreeNodeLevel ?? 0) - (right.categoryTreeNodeLevel ?? 0))
          .map((ancestor) => ancestor.categoryName?.trim())
          .filter((name): name is string => Boolean(name));
        return [{
          categoryId,
          categoryName,
          categoryPath: [...ancestors, categoryName].filter((name, index, values) => values.indexOf(name) === index).join(" > "),
        }];
      }).slice(0, 8);
      return { ok: true, suggestions };
    } catch (error) {
      return { ok: false, error: `eBay category lookup failed: ${error instanceof Error ? error.message : "Unknown eBay error."}` };
    }
  },
});

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

async function refreshAccessToken(ctx: ActionCtx, forceRefresh = false) {
  const connection = await ctx.runQuery(internal.ebay.getConnection, { singletonKey: singletonKey() });
  if (!connection) throw new Error("Connect an eBay seller account first.");
  if (!forceRefresh && connection.accessTokenExpiresAt > Date.now() + 300_000) return connection.accessToken;

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

function removeCatalogIdentifiers(aspects: Record<string, string[]>) {
  const cleaned = { ...aspects };
  for (const name of Object.keys(cleaned)) {
    if (["upc", "ean", "isbn"].includes(name.trim().toLowerCase())) delete cleaned[name];
  }
  return cleaned;
}

function aspectKey(aspects: Record<string, string[]>, name: string) {
  const normalized = name.trim().toLowerCase();
  return Object.keys(aspects).find((key) => key.trim().toLowerCase() === normalized);
}

function setAspectDefault(aspects: Record<string, string[]>, name: string, value?: string) {
  const trimmed = value?.trim();
  if (!trimmed || aspectKey(aspects, name)) return;
  aspects[name] = [trimmed];
}

function setAspect(aspects: Record<string, string[]>, name: string, value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return;
  const existingKey = aspectKey(aspects, name);
  if (existingKey && existingKey !== name) delete aspects[existingKey];
  aspects[name] = [trimmed];
}

function defaultLanguageForAsset(asset: { type: string; mediaFormat?: string }) {
  const identity = `${asset.type} ${asset.mediaFormat ?? ""}`.toLowerCase();
  return /book|dvd|blu|cd|music|game/.test(identity) ? "English" : undefined;
}

function isEbayError(error: unknown, errorId: number) {
  return error instanceof Error && error.message.includes(`eBay ${errorId}`);
}

function conditionForEbay(condition?: string) {
  const normalized = condition?.trim().toLowerCase() ?? "";
  if (["new", "brand new", "sealed"].includes(normalized)) return "NEW";
  if (normalized.includes("like new")) return "LIKE_NEW";
  if (normalized.includes("very good")) return "USED_VERY_GOOD";
  if (normalized.includes("acceptable")) return "USED_ACCEPTABLE";
  if (normalized.includes("parts")) return "FOR_PARTS_OR_NOT_WORKING";
  return "USED_GOOD";
}

function defaultPackageForAsset(asset: { type?: string; mediaFormat?: string }) {
  const format = `${asset.type ?? ""} ${asset.mediaFormat ?? ""}`.toLowerCase();
  if (format.includes("cd") || format.includes("music")) {
    return { packageType: "PACKAGE_THICK_ENVELOPE", weightOz: 6 };
  }
  if (format.includes("dvd") || format.includes("blu") || format.includes("game")) {
    return { packageType: "PACKAGE_THICK_ENVELOPE", weightOz: 8 };
  }
  return { packageType: "PACKAGE_THICK_ENVELOPE", weightOz: 16 };
}

function categoryForAsset(
  listing: { ebayCategoryId?: string; cardProductType?: string },
  asset: { type?: string; mediaFormat?: string; cardProductType?: string },
  settings: {
    dvdCategoryId?: string;
    blurayCategoryId?: string;
    bookCategoryId?: string;
    cdCategoryId?: string;
    gameCategoryId?: string;
    pokemonCardCategoryId?: string;
    sportsCardCategoryId?: string;
    yugiohCardCategoryId?: string;
    otherCategoryId?: string;
  } | null,
) {
  if (listing.ebayCategoryId) return listing.ebayCategoryId;
  const format = `${asset.mediaFormat ?? ""} ${asset.type ?? ""}`.toLowerCase();
  const cardProductType = (listing.cardProductType || asset.cardProductType || "Single Card").toLowerCase();
  if (format.includes("sports card")) {
    if (cardProductType.includes("lot")) return "261329";
    if (cardProductType.includes("complete set")) return "261330";
    if (cardProductType.includes("sealed pack")) return "261331";
    if (cardProductType.includes("sealed box")) return "261332";
    return "261328";
  }
  if (format.includes("pokemon") || format.includes("pokémon") || format.includes("yu-gi-oh") || format.includes("yugioh")) {
    if (cardProductType.includes("lot")) return "183455";
    if (cardProductType.includes("complete set")) return "183459";
    if (cardProductType.includes("sealed pack")) return "183456";
    if (cardProductType.includes("sealed box")) return "261044";
    return "183454";
  }
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
    pokemonCardCategoryId: v.optional(v.string()),
    sportsCardCategoryId: v.optional(v.string()),
    yugiohCardCategoryId: v.optional(v.string()),
    otherCategoryId: v.optional(v.string()),
    activeListingTarget: v.optional(v.number()),
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
      ebayDraftStatus: "Staged with eBay",
      ebayDraftCreatedAt: Date.now(),
      ebayLastError: undefined,
      pricingStatus: "eBay Offer Staged",
      updatedAt: Date.now(),
    });
  },
});

export const markOfferPublished = internalMutation({
  args: {
    listingId: v.id("marketplaceListings"),
    ebayListingId: v.string(),
    listingUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.listingId, {
      externalListingId: args.ebayListingId,
      listingUrl: args.listingUrl,
      status: "Active",
      listedDate: new Date().toISOString().slice(0, 10),
      ebayDraftStatus: "Published",
      ebayLastError: undefined,
      pricingStatus: "Published",
      updatedAt: Date.now(),
    });
  },
});

export const markPublishedPriceUpdated = internalMutation({
  args: {
    listingId: v.id("marketplaceListings"),
    newPrice: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found.");
    const now = Date.now();
    await ctx.db.insert("listingPriceHistory", {
      listingId: listing._id,
      assetId: listing.assetId,
      date: now,
      price: args.newPrice,
      reason: args.reason,
      createdAt: now,
    });
    await ctx.db.patch(listing._id, {
      currentPrice: args.newPrice,
      pricingSource: "eBay live price update",
      pricingUpdatedAt: now,
      ebayLastError: undefined,
      updatedAt: now,
    });
  },
});

export const markDraftError = internalMutation({
  args: { listingId: v.id("marketplaceListings"), message: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.listingId, { ebayLastError: args.message, updatedAt: Date.now() });
  },
});

export const reconcileSoldOrderLine = internalMutation({
  args: {
    externalListingId: v.optional(v.string()),
    sku: v.optional(v.string()),
    orderId: v.string(),
    soldDate: v.string(),
    soldPrice: v.number(),
    shippingCharged: v.optional(v.number()),
    fees: v.optional(v.number()),
    buyer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const listingById = args.externalListingId
      ? await ctx.db.query("marketplaceListings").withIndex("by_externalListingId", (q) => q.eq("externalListingId", args.externalListingId)).unique()
      : null;
    const listingBySku = !listingById && args.sku
      ? await ctx.db.query("marketplaceListings").withIndex("by_sku", (q) => q.eq("sku", args.sku)).filter((q) => q.eq(q.field("platform"), "eBay")).first()
      : null;
    const listing = listingById ?? listingBySku;
    if (!listing || listing.platform.toLowerCase() !== "ebay") return { matched: false, updated: false };

    const now = Date.now();
    const alreadyCurrent = listing.status === "Sold"
      && listing.ebayOrderId === args.orderId
      && listing.soldPrice === args.soldPrice
      && listing.shippingCharged === args.shippingCharged
      && listing.fees === args.fees;
    if (alreadyCurrent) {
      await ctx.db.patch(listing._id, { ebayLastSyncedAt: now, updatedAt: now });
      await ctx.db.patch(listing.assetId, {
        status: "Sold",
        soldPrice: args.soldPrice,
        fees: args.fees,
        needsValueCheck: false,
        valueSource: "Actual Sale",
        updatedAt: now,
      });
      return { matched: true, updated: false };
    }

    await ctx.db.patch(listing._id, {
      status: "Sold",
      soldDate: args.soldDate,
      soldPrice: args.soldPrice,
      shippingCharged: args.shippingCharged,
      fees: args.fees,
      buyer: args.buyer,
      ebayOrderId: args.orderId,
      ebayLastSyncedAt: now,
      ebayDraftStatus: "Sold on eBay",
      ebayLastError: undefined,
      updatedAt: now,
    });
    const asset = await ctx.db.get(listing.assetId);
    await ctx.db.patch(listing.assetId, {
      status: "Sold",
      soldPrice: args.soldPrice,
      fees: args.fees,
      needsValueCheck: false,
      valueSource: "Actual Sale",
      updatedAt: now,
    });
    const existingSale = await ctx.db.query("sales").withIndex("by_listingId", (q) => q.eq("listingId", listing._id)).unique();
    const saleRecord = {
      assetId: listing.assetId,
      listingId: listing._id,
      platform: "eBay",
      soldDate: args.soldDate,
      soldPrice: args.soldPrice,
      purchasePrice: asset?.purchasePrice,
      shippingCharged: args.shippingCharged,
      fees: args.fees,
      shipping: listing.shippingCost,
      buyer: args.buyer,
      notes: existingSale?.notes || `Synced from eBay order ${args.orderId}`,
      updatedAt: now,
    };
    if (existingSale) await ctx.db.patch(existingSale._id, saleRecord);
    else await ctx.db.insert("sales", { ...saleRecord, createdAt: now });
    return { matched: true, updated: true };
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
    settings: Record<string, string | number | undefined>;
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
        pokemonCardCategoryId: settings?.pokemonCardCategoryId,
        sportsCardCategoryId: settings?.sportsCardCategoryId,
        yugiohCardCategoryId: settings?.yugiohCardCategoryId,
        otherCategoryId: settings?.otherCategoryId,
        activeListingTarget: settings?.activeListingTarget ?? 200,
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

export const getSellerListingSummary = action({
  args: { adminKey: v.string() },
  handler: async (ctx, args): Promise<SellerListingSummary> => {
    requireAdminKey(args.adminKey);
    try {
      const connection = await ctx.runQuery(internal.ebay.getConnection, { singletonKey: singletonKey() });
      const grantedScopes = new Set(connection?.scopes.split(/\s+/).filter(Boolean) ?? []);
      const accessToken = await refreshAccessToken(ctx, !grantedScopes.has(EBAY_BROWSE_SCOPE));
      const response = await tradingApiFetch(accessToken, "GetMyeBaySelling", `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ActiveList>
    <Include>true</Include>
    <Pagination><EntriesPerPage>1</EntriesPerPage><PageNumber>1</PageNumber></Pagination>
  </ActiveList>
  <ScheduledList>
    <Include>true</Include>
    <Pagination><EntriesPerPage>1</EntriesPerPage><PageNumber>1</PageNumber></Pagination>
  </ScheduledList>
</GetMyeBaySellingRequest>`);
      const payload = response as {
        ActiveList?: { PaginationResult?: { TotalNumberOfEntries?: number | string } };
        ScheduledList?: { PaginationResult?: { TotalNumberOfEntries?: number | string } };
      };
      const activeCount = Number(payload.ActiveList?.PaginationResult?.TotalNumberOfEntries ?? 0);
      const scheduledCount = Number(payload.ScheduledList?.PaginationResult?.TotalNumberOfEntries ?? 0);
      if (!Number.isFinite(activeCount) || !Number.isFinite(scheduledCount)) {
        throw new Error("eBay returned an invalid seller listing count.");
      }
      return { activeCount, scheduledCount, checkedAt: Date.now() };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load the eBay account listing count.";
      const needsAuthorization = /scope|permission|access denied|authorization|token/i.test(message);
      throw new ConvexError(needsAuthorization
        ? "Reconnect eBay once to authorize the account-wide listing count."
        : message);
    }
  },
});

export const syncSoldOrders = action({
  args: { adminKey: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ ordersChecked: number; lineItemsChecked: number; matched: number; updated: number; unmatched: number }> => {
    requireAdminKey(args.adminKey);
    try {
      const accessToken = await refreshAccessToken(ctx);
      const days = Math.min(90, Math.max(1, Math.round(args.days ?? 30)));
      const end = new Date();
      const start = new Date(end.getTime() - days * 86_400_000);
      const filter = `creationdate:[${start.toISOString()}..${end.toISOString()}]`;
      let offset = 0;
      let ordersChecked = 0;
      let lineItemsChecked = 0;
      let matched = 0;
      let updated = 0;
      let unmatched = 0;

      while (offset < 1000) {
        const params = new URLSearchParams({ filter, limit: "200", offset: String(offset) });
        const page = await ebayFetch(accessToken, `/sell/fulfillment/v1/order?${params.toString()}`) as {
          orders?: EbayOrder[];
          total?: number;
        };
        const orders = page.orders ?? [];
        ordersChecked += orders.length;
        for (const order of orders) {
          if (!order.orderId || order.orderPaymentStatus !== "PAID" || /cancel/i.test(order.cancelStatus?.cancelState ?? "")) continue;
          const lineItems = order.lineItems ?? [];
          const orderItemTotal = lineItems.reduce((sum, lineItem) => sum + Number(lineItem.discountedLineItemCost?.value ?? lineItem.lineItemCost?.value ?? 0), 0);
          const shippingTotal = Number(order.pricingSummary?.deliveryCost?.value ?? 0);
          const feeTotal = Number(order.totalMarketplaceFee?.value ?? 0);
          for (const lineItem of lineItems) {
            lineItemsChecked += 1;
            const soldPrice = Math.round(Number(lineItem.discountedLineItemCost?.value ?? lineItem.lineItemCost?.value ?? 0) * 100) / 100;
            if (!Number.isFinite(soldPrice) || soldPrice <= 0) continue;
            const share = orderItemTotal > 0 ? soldPrice / orderItemTotal : 1 / Math.max(1, lineItems.length);
            const result: { matched: boolean; updated: boolean } = await ctx.runMutation(internal.ebay.reconcileSoldOrderLine, {
              externalListingId: lineItem.legacyItemId,
              sku: lineItem.sku,
              orderId: order.orderId,
              soldDate: (order.creationDate ?? new Date().toISOString()).slice(0, 10),
              soldPrice,
              shippingCharged: Number.isFinite(shippingTotal) ? Math.round(shippingTotal * share * 100) / 100 : undefined,
              fees: Number.isFinite(feeTotal) ? Math.round(feeTotal * share * 100) / 100 : undefined,
              buyer: order.buyer?.username,
            });
            if (result.matched) matched += 1;
            else unmatched += 1;
            if (result.updated) updated += 1;
          }
        }
        offset += orders.length;
        if (!orders.length || offset >= (page.total ?? 0)) break;
      }
      return { ordersChecked, lineItemsChecked, matched, updated, unmatched };
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      const message = error instanceof Error ? error.message : "Unknown eBay error.";
      const needsAuthorization = /scope|permission|access denied|authorization|token|forbidden|unauthorized/i.test(message);
      throw new ConvexError(needsAuthorization
        ? "eBay has not authorized sold-order access. Reconnect eBay, approve access, then retry Sync eBay Sales."
        : `eBay sold-order sync failed: ${message}`);
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
    pokemonCardCategoryId: v.optional(v.string()),
    sportsCardCategoryId: v.optional(v.string()),
    yugiohCardCategoryId: v.optional(v.string()),
    otherCategoryId: v.optional(v.string()),
    activeListingTarget: v.optional(v.number()),
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
    if (!args.listingIds.length) throw new ConvexError("Select at least one listing to price.");
    if (args.listingIds.length > 25) throw new ConvexError("Price up to 25 listings at a time.");
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
      pokemonCardCategoryId: settings?.pokemonCardCategoryId,
      sportsCardCategoryId: settings?.sportsCardCategoryId,
      yugiohCardCategoryId: settings?.yugiohCardCategoryId,
      otherCategoryId: settings?.otherCategoryId,
    });
    return { locationKey, created: !exists };
  },
});

export const ensureMediaMailPolicy = action({
  args: { adminKey: v.string(), buyerShippingCost: v.number() },
  handler: async (ctx, args): Promise<{ fulfillmentPolicyId: string; created: boolean }> => {
    requireAdminKey(args.adminKey);
    if (!Number.isFinite(args.buyerShippingCost) || args.buyerShippingCost < 0) {
      throw new Error("Media Mail buyer charge must be zero or higher.");
    }
    const accessToken = await refreshAccessToken(ctx);
    const marketplace = "EBAY_US";
    const policiesBody = await ebayFetch(
      accessToken,
      `/sell/account/v1/fulfillment_policy?marketplace_id=${marketplace}`,
    ) as { fulfillmentPolicies?: Array<{ fulfillmentPolicyId: string; name: string }> };
    const existing = policiesBody.fulfillmentPolicies?.find((policy) => policy.name === "FlipTracker Media Mail");
    let fulfillmentPolicyId = existing?.fulfillmentPolicyId;
    if (!fulfillmentPolicyId) {
      const created = await ebayFetch(accessToken, "/sell/account/v1/fulfillment_policy", {
        method: "POST",
        body: JSON.stringify({
          name: "FlipTracker Media Mail",
          description: "USPS Media Mail for eligible books, recorded media, and sound recordings.",
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
              shippingCost: { value: args.buyerShippingCost.toFixed(2), currency: "USD" },
              additionalShippingCost: { value: "1.00", currency: "USD" },
              freeShipping: args.buyerShippingCost === 0,
            }],
          }],
        }),
      }) as { fulfillmentPolicyId?: string };
      fulfillmentPolicyId = created.fulfillmentPolicyId;
    }
    if (!fulfillmentPolicyId) throw new Error("eBay did not return the Media Mail policy ID.");

    const settings = await ctx.runQuery(internal.ebay.getSettings, { singletonKey: singletonKey() });
    await ctx.runMutation(internal.ebay.saveSettingsRecord, {
      singletonKey: singletonKey(),
      environment: environment(),
      marketplaceId: settings?.marketplaceId ?? marketplace,
      currency: settings?.currency ?? "USD",
      merchantLocationKey: settings?.merchantLocationKey,
      fulfillmentPolicyId,
      paymentPolicyId: settings?.paymentPolicyId,
      returnPolicyId: settings?.returnPolicyId,
      dvdCategoryId: settings?.dvdCategoryId,
      blurayCategoryId: settings?.blurayCategoryId,
      bookCategoryId: settings?.bookCategoryId,
      cdCategoryId: settings?.cdCategoryId,
      gameCategoryId: settings?.gameCategoryId,
      pokemonCardCategoryId: settings?.pokemonCardCategoryId,
      sportsCardCategoryId: settings?.sportsCardCategoryId,
      yugiohCardCategoryId: settings?.yugiohCardCategoryId,
      otherCategoryId: settings?.otherCategoryId,
    });
    return { fulfillmentPolicyId, created: !existing };
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
      pokemonCardCategoryId: settings?.pokemonCardCategoryId,
      sportsCardCategoryId: settings?.sportsCardCategoryId,
      yugiohCardCategoryId: settings?.yugiohCardCategoryId,
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
      const isBook = `${asset.type} ${asset.mediaFormat ?? ""}`.toLowerCase().includes("book");
      const isCard = `${asset.type} ${asset.mediaFormat ?? ""}`.toLowerCase().includes("card");
      const aspects = removeCatalogIdentifiers(parseItemSpecifics(listing.itemSpecifics));
      if (listing.language) setAspect(aspects, "Language", listing.language);
      else setAspectDefault(aspects, "Language", defaultLanguageForAsset(asset));
      if (isBook) {
        const bookTitle = (listing.bookTitle || asset.title).trim().slice(0, 65);
        setAspect(aspects, "Book Title", bookTitle);
        if (listing.author) setAspect(aspects, "Author", listing.author);
        else setAspectDefault(aspects, "Author", asset.author);
        if (!aspectKey(aspects, "Author")) throw new Error("Add an Author to this book listing before staging it with eBay.");
      }
      setAspectDefault(aspects, "Format", asset.mediaFormat);
      setAspectDefault(aspects, isBook ? "Publisher" : "Studio", asset.studio);
      setAspectDefault(aspects, "Release Year", asset.releaseYear);
      setAspectDefault(aspects, "Rating", asset.rating);
      if (isCard) {
        setAspectDefault(aspects, "Game", listing.cardGame || asset.cardGame);
        setAspectDefault(aspects, "Sport", listing.cardSport || asset.cardSport);
        setAspectDefault(aspects, "Set", listing.cardSet || asset.cardSet);
        setAspectDefault(aspects, "Card Number", listing.cardNumber || asset.cardNumber);
        setAspectDefault(aspects, "Player/Athlete", listing.cardPlayer || asset.cardPlayer);
        setAspectDefault(aspects, "Team", listing.cardTeam || asset.cardTeam);
      }

      const product: Record<string, unknown> = {
        title: listing.title.trim().slice(0, 80),
        description: listing.description?.trim() || listing.title.trim(),
        aspects,
      };
      const barcode = asset.upc || asset.barcode;
      if (barcode) {
        const digits = barcode.replace(/\D/g, "");
        if (isBook) product.isbn = [barcode.replace(/[^0-9X]/gi, "").toUpperCase()];
        else if (digits.length === 13) product.ean = [digits];
        else product.upc = [digits];
      }
      const ebayCondition = conditionForEbay(listing.condition || asset.condition);
      const metadataCoverAllowed = isBook && Boolean(asset.coverImageUrl);
      const requestedImageMode = listing.imageMode || (ebayCondition === "NEW" || metadataCoverAllowed ? "eBay Catalog" : "Actual Item Photo");
      const hasActualItemPhotos = bundle.photos.length > 0 || Boolean(asset.photoDataUrl);
      // Actual photos are authoritative once attached. This also recovers older book
      // drafts that requested catalog art before the seller photographed the item.
      const imageMode = hasActualItemPhotos ? "Actual Item Photo" : requestedImageMode;
      let imageUrl: string | undefined;
      let imageFingerprint: string | undefined;
      let imageSource = "eBay catalog match";
      if (imageMode === "eBay Catalog") {
        if (metadataCoverAllowed) {
          imageUrl = asset.coverImageUrl;
          imageSource = "eBay catalog match by ISBN";
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
        availability: {
          shipToLocationAvailability: {
            quantity: 1,
            availabilityDistributions: [{
              merchantLocationKey: settings.merchantLocationKey,
              quantity: 1,
            }],
          },
        },
        condition: ebayCondition,
        product,
      };
      if (!["NEW", "LIKE_NEW"].includes(ebayCondition)) {
        inventoryItem.conditionDescription = `${listing.condition || asset.condition || "Used"} pre-owned condition. See the listing description for item details.`.slice(0, 1000);
      }
      const defaultPackage = defaultPackageForAsset(asset);
      const packageWeightOz = listing.packageWeightOz ?? defaultPackage.weightOz;
      if (!Number.isFinite(packageWeightOz) || packageWeightOz <= 0) throw new Error("Package weight must be above zero.");
      {
        const packageWeightAndSize: Record<string, unknown> = {
          weight: { value: packageWeightOz, unit: "OUNCE" },
        };
        packageWeightAndSize.packageType = listing.packageType || defaultPackage.packageType;
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

      try {
        await ebayFetch(accessToken, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
          method: "PUT",
          body: JSON.stringify(inventoryItem),
        });
      } catch (error) {
        if (!isEbayError(error, 25001)) {
          throw new Error(`eBay inventory item validation failed: ${error instanceof Error ? error.message : "Unknown eBay error."}`);
        }

        // eBay occasionally reports 25001 for optional catalog data without naming the
        // rejected field. Retry once with the stable core product fields, GTIN, and any
        // eBay-hosted photos that were already accepted by Picture Services.
        const minimalProduct = { ...product };
        const requiredAspects: Record<string, string[]> = {};
        const languageKey = aspectKey(aspects, "Language");
        const bookTitleKey = aspectKey(aspects, "Book Title");
        const authorKey = aspectKey(aspects, "Author");
        if (languageKey) requiredAspects.Language = aspects[languageKey];
        if (bookTitleKey) requiredAspects["Book Title"] = aspects[bookTitleKey];
        if (authorKey) requiredAspects.Author = aspects[authorKey];
        if (Object.keys(requiredAspects).length) minimalProduct.aspects = requiredAspects;
        else delete minimalProduct.aspects;
        const minimalInventoryItem = { ...inventoryItem, product: minimalProduct };
        try {
          await ebayFetch(accessToken, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
            method: "PUT",
            body: JSON.stringify(minimalInventoryItem),
          });
        } catch (retryError) {
          throw new Error(`eBay inventory item validation failed after a catalog-safe retry: ${retryError instanceof Error ? retryError.message : "Unknown eBay error."}`);
        }
      }

      const offer: Record<string, unknown> = {
        sku,
        marketplaceId: settings?.marketplaceId ?? "EBAY_US",
        format: "FIXED_PRICE",
        listingDuration: "GTC",
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
        try {
          await ebayFetch(accessToken, `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
            method: "PUT",
            body: JSON.stringify(offerPatch),
          });
        } catch (error) {
          if (!isEbayError(error, 25604)) {
            throw new Error(`eBay offer validation failed: ${error instanceof Error ? error.message : "Unknown eBay error."}`);
          }
          await delay(1_000);
          try {
            await ebayFetch(accessToken, `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
              method: "PUT",
              body: JSON.stringify(offerPatch),
            });
          } catch (retryError) {
            throw new Error(`eBay offer validation failed after refreshing inventory availability: ${retryError instanceof Error ? retryError.message : "Unknown eBay error."}`);
          }
        }
      } else {
        let result: { offerId?: string };
        try {
          result = await ebayFetch(accessToken, "/sell/inventory/v1/offer", {
            method: "POST",
            body: JSON.stringify(offer),
          }) as { offerId?: string };
        } catch (error) {
          throw new Error(`eBay offer validation failed: ${error instanceof Error ? error.message : "Unknown eBay error."}`);
        }
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
      throw new ConvexError(message);
    }
  },
});

export const publishOffer = action({
  args: { adminKey: v.string(), listingId: v.id("marketplaceListings") },
  handler: async (ctx, args): Promise<{ listingId: string; listingUrl: string }> => {
    requireAdminKey(args.adminKey);
    const bundle = await ctx.runQuery(internal.ebay.getDraftBundle, { listingId: args.listingId });
    if (!bundle) throw new Error("Listing or inventory item not found.");
    if (!bundle.listing.ebayOfferId) throw new Error("Stage this item with eBay before publishing it.");
    if (bundle.listing.externalListingId && bundle.listing.listingUrl) {
      return { listingId: bundle.listing.externalListingId, listingUrl: bundle.listing.listingUrl };
    }

    try {
      const accessToken = await refreshAccessToken(ctx);
      const result = await ebayFetch(
        accessToken,
        `/sell/inventory/v1/offer/${encodeURIComponent(bundle.listing.ebayOfferId)}/publish`,
        { method: "POST" },
      ) as { listingId?: string };
      if (!result.listingId) throw new Error("eBay published the offer but did not return a listing ID.");
      const listingUrl = environment() === "production"
        ? `https://www.ebay.com/itm/${result.listingId}`
        : `https://www.sandbox.ebay.com/itm/${result.listingId}`;
      await ctx.runMutation(internal.ebay.markOfferPublished, {
        listingId: args.listingId,
        ebayListingId: result.listingId,
        listingUrl,
      });
      return { listingId: result.listingId, listingUrl };
    } catch (error) {
      const message = `eBay publish failed: ${error instanceof Error ? error.message : "Unknown eBay error."}`;
      await ctx.runMutation(internal.ebay.markDraftError, { listingId: args.listingId, message });
      throw new ConvexError(message);
    }
  },
});

export const updatePublishedPrice = action({
  args: {
    adminKey: v.string(),
    listingId: v.id("marketplaceListings"),
    newPrice: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<{ oldPrice: number; newPrice: number; listingId: string }> => {
    requireAdminKey(args.adminKey);
    const bundle = await ctx.runQuery(internal.ebay.getDraftBundle, { listingId: args.listingId });
    if (!bundle) throw new ConvexError("Listing or inventory item not found.");
    const { listing } = bundle;
    if (listing.platform.toLowerCase() !== "ebay" || listing.status !== "Active" || !listing.externalListingId) {
      throw new ConvexError("Only active eBay listings can be repriced through this action.");
    }
    if (!listing.ebayOfferId) throw new ConvexError("This listing is missing its eBay offer ID and cannot be repriced automatically.");
    if (!Number.isFinite(args.newPrice) || args.newPrice < 0.99) throw new ConvexError("The new eBay price must be at least $0.99.");
    const newPrice = moneyRound(args.newPrice);
    const oldPrice = moneyRound(listing.currentPrice ?? listing.listedPrice ?? 0);
    if (newPrice === oldPrice) throw new ConvexError("The calculated price is the same as the current eBay price.");

    try {
      const accessToken = await refreshAccessToken(ctx);
      const settings = await ctx.runQuery(internal.ebay.getSettings, { singletonKey: singletonKey() });
      const response = await ebayFetch(accessToken, "/sell/inventory/v1/bulk_update_price_quantity", {
        method: "POST",
        body: JSON.stringify({
          requests: [{
            offers: [{
              offerId: listing.ebayOfferId,
              price: { value: newPrice.toFixed(2), currency: settings?.currency ?? "USD" },
            }],
          }],
        }),
      }) as {
        responses?: Array<{
          offerId?: string;
          statusCode?: number;
          errors?: Array<{ errorId?: number; message?: string; longMessage?: string; parameters?: Array<{ name?: string; value?: string }> }>;
        }>;
      } | undefined;
      const updateResult = response?.responses?.find((entry) => entry.offerId === listing.ebayOfferId)
        ?? response?.responses?.[0];
      if (!updateResult || updateResult.statusCode !== 200 || updateResult.errors?.length) {
        throw new Error(ebayError({ errors: updateResult?.errors }, updateResult?.statusCode ?? 500));
      }
      await ctx.runMutation(internal.ebay.markPublishedPriceUpdated, {
        listingId: listing._id,
        newPrice,
        reason: args.reason.trim().slice(0, 250) || "eBay live price updated",
      });
      return { oldPrice, newPrice, listingId: listing.externalListingId };
    } catch (error) {
      const message = `eBay price update failed: ${error instanceof Error ? error.message : "Unknown eBay error."}`;
      await ctx.runMutation(internal.ebay.markDraftError, { listingId: listing._id, message });
      throw new ConvexError(message);
    }
  },
});
