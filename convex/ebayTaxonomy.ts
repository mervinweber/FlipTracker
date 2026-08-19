import { v } from "convex/values";
import { action } from "./_generated/server";

const EBAY_API_SCOPE = "https://api.ebay.com/oauth/api_scope";

type EbayEnvironment = "sandbox" | "production";

type EbayErrorParameter = {
  name?: string;
  value?: string;
};

type EbayError = {
  errorId?: number;
  domain?: string;
  category?: string;
  message?: string;
  longMessage?: string;
  parameters?: EbayErrorParameter[];
};

type EbayErrorResponse = {
  errors?: EbayError[];
  error?: string;
  error_description?: string;
};

type EbayTokenResponse = EbayErrorResponse & {
  access_token?: string;
};

type EbayCategoryTreeResponse = EbayErrorResponse & {
  categoryTreeId?: string;
};

type EbayAspectValue = {
  localizedValue?: string;
};

type EbayAspectConstraint = {
  aspectRequired?: boolean;
  aspectMode?: string;
  itemToAspectCardinality?: string;
  aspectMaxLength?: number;
};

type EbayAspect = {
  localizedAspectName?: string;
  aspectConstraint?: EbayAspectConstraint;
  aspectValues?: EbayAspectValue[];
};

type EbayAspectsResponse = EbayErrorResponse & {
  aspects?: EbayAspect[];
};

const aspectValidator = v.object({
  name: v.string(),
  required: v.boolean(),
  mode: v.string(),
  cardinality: v.string(),
  values: v.array(v.string()),
  valueCount: v.number(),
  valuesTruncated: v.boolean(),
  maxLength: v.union(v.number(), v.null()),
});

function environment(): EbayEnvironment {
  return process.env.EBAY_ENVIRONMENT?.toLowerCase() === "production" ? "production" : "sandbox";
}

function apiBaseUrl() {
  return environment() === "production" ? "https://api.ebay.com" : "https://api.sandbox.ebay.com";
}

function requiredEnv(name: "EBAY_CLIENT_ID" | "EBAY_CLIENT_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured in Convex.`);
  return value;
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readableEbayError(body: unknown, status: number) {
  if (typeof body === "string" && body.trim()) return `eBay API ${status}: ${body.trim()}`;
  if (!body || typeof body !== "object") return `eBay API request failed with HTTP ${status}.`;

  const response = body as EbayErrorResponse;
  const details = (response.errors ?? []).map((error) => {
    const message = error.longMessage?.trim() || error.message?.trim() || "Unknown eBay error";
    const parameters = (error.parameters ?? [])
      .map((parameter) => [parameter.name, parameter.value].filter(Boolean).join("="))
      .filter(Boolean);
    const suffix = [
      error.errorId ? `eBay ${error.errorId}` : "",
      parameters.length ? parameters.join(", ") : "",
    ].filter(Boolean).join("; ");
    return suffix ? `${message} (${suffix})` : message;
  });

  if (details.length) return details.join(" | ");
  if (response.error_description?.trim()) return `eBay OAuth ${status}: ${response.error_description.trim()}`;
  if (response.error?.trim()) return `eBay OAuth ${status}: ${response.error.trim()}`;
  return `eBay API request failed with HTTP ${status}.`;
}

async function ebayJson<T>(url: string, init: RequestInit, context: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new Error(`${context} could not reach eBay: ${error instanceof Error ? error.message : "Network error."}`);
  }

  const body = await responseBody(response);
  if (!response.ok) throw new Error(`${context} failed: ${readableEbayError(body, response.status)}`);
  if (!body || typeof body !== "object") throw new Error(`${context} failed: eBay returned an empty response.`);
  return body as T;
}

async function applicationAccessToken() {
  const credentials = btoa(`${requiredEnv("EBAY_CLIENT_ID")}:${requiredEnv("EBAY_CLIENT_SECRET")}`);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: EBAY_API_SCOPE,
  });
  const response = await ebayJson<EbayTokenResponse>(
    `${apiBaseUrl()}/identity/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
    "eBay application authentication",
  );

  if (!response.access_token) throw new Error("eBay application authentication failed: no access token was returned.");
  return response.access_token;
}

export const getCategoryAspects = action({
  args: {
    marketplaceId: v.string(),
    categoryId: v.string(),
  },
  returns: v.object({
    marketplaceId: v.string(),
    categoryTreeId: v.string(),
    categoryId: v.string(),
    aspects: v.array(aspectValidator),
  }),
  handler: async (_ctx, args) => {
    const marketplaceId = args.marketplaceId.trim().toUpperCase();
    const categoryId = args.categoryId.trim();
    if (!marketplaceId) throw new Error("marketplaceId is required for eBay category-aspect discovery.");
    if (!categoryId) throw new Error("categoryId is required for eBay category-aspect discovery.");

    const accessToken = await applicationAccessToken();
    const authorization = { Authorization: `Bearer ${accessToken}` };
    const tree = await ebayJson<EbayCategoryTreeResponse>(
      `${apiBaseUrl()}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${encodeURIComponent(marketplaceId)}`,
      { headers: authorization },
      `eBay category-tree lookup for ${marketplaceId}`,
    );
    const categoryTreeId = tree.categoryTreeId?.trim();
    if (!categoryTreeId) throw new Error(`eBay did not return a default category tree for ${marketplaceId}.`);

    const response = await ebayJson<EbayAspectsResponse>(
      `${apiBaseUrl()}/commerce/taxonomy/v1/category_tree/${encodeURIComponent(categoryTreeId)}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`,
      { headers: authorization },
      `eBay aspect lookup for category ${categoryId}`,
    );
    const aspects = (response.aspects ?? []).flatMap((aspect) => {
      const name = aspect.localizedAspectName?.trim();
      if (!name) return [];
      const constraint = aspect.aspectConstraint;
      const allValues = [...new Set(
        (aspect.aspectValues ?? [])
          .map((value) => value.localizedValue?.trim())
          .filter((value): value is string => Boolean(value)),
      )];
      const values = allValues.slice(0, 250);
      return [{
        name,
        required: constraint?.aspectRequired === true,
        mode: constraint?.aspectMode?.trim() || "UNKNOWN",
        cardinality: constraint?.itemToAspectCardinality?.trim() || "UNKNOWN",
        values,
        valueCount: allValues.length,
        valuesTruncated: allValues.length > values.length,
        maxLength: typeof constraint?.aspectMaxLength === "number" ? constraint.aspectMaxLength : null,
      }];
    });

    return { marketplaceId, categoryTreeId, categoryId, aspects };
  },
});
