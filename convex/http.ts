import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured in Convex.`);
  return value;
}

function environment() {
  return process.env.EBAY_ENVIRONMENT?.toLowerCase() === "production" ? "production" : "sandbox";
}

function apiBase() {
  return environment() === "production" ? "https://api.ebay.com" : "https://api.sandbox.ebay.com";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function tokenError(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const record = body as { error_description?: string };
    if (record.error_description) return record.error_description;
  }
  return `eBay token exchange failed (${status}).`;
}

async function exchangeCode(code: string) {
  const credentials = btoa(`${requiredEnv("EBAY_CLIENT_ID")}:${requiredEnv("EBAY_CLIENT_SECRET")}`);
  const response = await fetch(`${apiBase()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: requiredEnv("EBAY_RUNAME"),
    }),
  });
  const body = await readBody(response);
  if (!response.ok) throw new Error(tokenError(body, response.status));
  return body as TokenResponse;
}

function redirect(returnUrl: string, result: "connected" | "error", message?: string) {
  const url = new URL(returnUrl);
  url.searchParams.set("ebay", result);
  if (message) url.searchParams.set("message", message.slice(0, 180));
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

const http = httpRouter();

http.route({
  path: "/ebay/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const fallbackUrl = process.env.EBAY_APP_URL || "https://flip-tracker-o45i.vercel.app/";
    try {
      const url = new URL(request.url);
      const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
      if (oauthError) throw new Error(oauthError);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) throw new Error("eBay did not return the required authorization details.");

      const savedState = await ctx.runMutation(internal.ebay.consumeOauthState, { stateHash: await sha256(state) });
      if (!savedState || savedState.environment !== environment()) throw new Error("The eBay authorization request expired. Start the connection again.");

      const token = await exchangeCode(code);
      if (!token.refresh_token) throw new Error("eBay did not return a refresh token. Reconnect and approve seller access.");
      const now = Date.now();
      await ctx.runMutation(internal.ebay.saveConnection, {
        singletonKey: `seller:${environment()}`,
        environment: environment(),
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        scopes: token.scope || "",
        accessTokenExpiresAt: now + token.expires_in * 1000,
        refreshTokenExpiresAt: token.refresh_token_expires_in ? now + token.refresh_token_expires_in * 1000 : undefined,
      });
      return redirect(savedState.returnUrl, "connected");
    } catch (error) {
      const message = error instanceof Error ? error.message : "eBay authorization failed.";
      return redirect(fallbackUrl, "error", message);
    }
  }),
});

export default http;
