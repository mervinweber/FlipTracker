import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

type CardGame = "pokemon" | "yugioh";
type CardCandidate = {
  provider: string;
  providerId: string;
  game: CardGame;
  name: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  printedCode?: string;
  rarity?: string;
  imageUrl?: string;
  marketPrice?: number;
  confidence: number;
};

function normalized(value?: string) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function normalizedCardNumber(value?: string) {
  const raw = normalized(value).split("/")[0];
  return /^\d+$/.test(raw) ? String(Number(raw)) : raw;
}

function cacheKey(args: { game: CardGame; printedCode?: string; setCode?: string; collectorNumber?: string; name?: string }) {
  return [args.game, args.printedCode, args.setCode, args.collectorNumber, args.name]
    .map((value) => normalized(value).toLowerCase())
    .join("|");
}

async function fetchJson(url: string, headers?: Record<string, string>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { "user-agent": "FlipTracker/0.8", ...headers } });
      const payload = await response.json().catch(() => null);
      if (response.ok) return payload;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 2) throw new Error(payload?.error || payload?.message || `Card catalog request failed (${response.status}).`);
    } catch (error) {
      if (attempt === 2) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error("Card catalog request failed after several attempts.");
}

function finitePrice(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : undefined;
}

async function lookupYugioh(args: { printedCode?: string; name?: string }): Promise<CardCandidate[]> {
  const printedCode = normalized(args.printedCode).toUpperCase();
  if (printedCode) {
    const payload = await fetchJson(`https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=${encodeURIComponent(printedCode)}`);
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : payload?.name || payload?.set_code ? [payload] : [];
    return rows.slice(0, 20).map((card: any) => ({
      provider: "ygoprodeck",
      providerId: String(card.id || printedCode),
      game: "yugioh" as const,
      name: String(card.name || "Unknown Yu-Gi-Oh! card"),
      setName: card.set_name,
      setCode: String(card.set_code || printedCode).split("-")[0],
      printedCode: card.set_code || printedCode,
      rarity: card.set_rarity,
      // YGOPRODeck asks clients to download and rehost images instead of hotlinking.
      imageUrl: undefined,
      marketPrice: finitePrice(card.set_price),
      confidence: card.set_code?.toUpperCase() === printedCode ? 0.99 : 0.88,
    }));
  }
  const name = normalized(args.name);
  if (!name) throw new Error("Enter the printed set code or card name.");
  const payload = await fetchJson(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(name)}&num=20&offset=0`);
  return (payload?.data || []).slice(0, 20).flatMap((card: any) => {
    const sets = Array.isArray(card.card_sets) && card.card_sets.length ? card.card_sets.slice(0, 6) : [{}];
    return sets.map((set: any) => ({
      provider: "ygoprodeck",
      providerId: String(card.id),
      game: "yugioh" as const,
      name: String(card.name),
      setName: set.set_name,
      setCode: set.set_code?.split("-")[0],
      printedCode: set.set_code,
      rarity: set.set_rarity,
      imageUrl: undefined,
      marketPrice: finitePrice(set.set_price),
      confidence: card.name?.toLowerCase() === name.toLowerCase() ? 0.9 : 0.72,
    }));
  }).slice(0, 20);
}

function pokemonQuery(args: { setCode?: string; collectorNumber?: string; name?: string }) {
  const parts: string[] = [];
  const safe = (value: string) => value.replace(/["\\]/g, "");
  if (normalized(args.setCode)) parts.push(`set.id:${safe(normalized(args.setCode))}`);
  if (normalized(args.collectorNumber)) parts.push(`number:${safe(normalizedCardNumber(args.collectorNumber))}`);
  if (normalized(args.name)) parts.push(`name:"${safe(normalized(args.name))}"`);
  if (!parts.length) throw new Error("Enter a set code, collector number, or card name.");
  return parts.join(" ");
}

async function lookupPokemon(args: { setCode?: string; collectorNumber?: string; name?: string }): Promise<CardCandidate[]> {
  const headers = process.env.POKEMON_TCG_API_KEY ? { "X-Api-Key": process.env.POKEMON_TCG_API_KEY } : undefined;
  const query = pokemonQuery(args);
  const fetchPokemon = async (search: string, pageSize: number) => {
    const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(search)}&pageSize=${pageSize}`;
    try {
      return await fetchJson(url, headers);
    } catch (error) {
      if (!headers) throw error;
      return await fetchJson(url);
    }
  };
  let payload;
  try {
    payload = await fetchPokemon(query, 20);
  } catch (error) {
    if (!normalized(args.collectorNumber)) throw error;
  }
  let cards = Array.isArray(payload?.data) ? payload.data : [];
  if (!cards.length && normalized(args.collectorNumber)) {
    const number = normalizedCardNumber(args.collectorNumber);
    const fallbackParts = [`number:${number.replace(/["\\]/g, "")}`];
    if (normalized(args.name)) fallbackParts.push(`name:"${normalized(args.name).replace(/["\\]/g, "")}"`);
    const fallback = await fetchPokemon(fallbackParts.join(" "), 250);
    cards = (Array.isArray(fallback?.data) ? fallback.data : []).filter((card: any) => {
      if (normalized(args.setCode) && normalized(card.set?.id) !== normalized(args.setCode)) return false;
      if (normalized(args.name) && normalized(card.name) !== normalized(args.name)) return false;
      return true;
    });
  }
  return cards.map((card: any) => ({
    provider: "pokemontcg",
    providerId: String(card.id),
    game: "pokemon" as const,
    name: String(card.name),
    setName: card.set?.name,
    setCode: card.set?.id,
    collectorNumber: card.number,
    rarity: card.rarity,
    imageUrl: card.images?.small,
    marketPrice: finitePrice(card.tcgplayer?.prices?.normal?.market ?? card.tcgplayer?.prices?.holofoil?.market ?? card.cardmarket?.prices?.averageSellPrice),
    confidence: card.set?.id?.toLowerCase() === normalized(args.setCode).toLowerCase() && normalizedCardNumber(card.number) === normalizedCardNumber(args.collectorNumber) ? 0.98 : 0.78,
  })).slice(0, 20);
}

export const getCached = internalQuery({
  args: { provider: v.string(), cacheKey: v.string() },
  handler: async (ctx, args) => await ctx.db.query("cardCatalogCache")
    .withIndex("by_provider_and_cacheKey", (q) => q.eq("provider", args.provider).eq("cacheKey", args.cacheKey))
    .unique(),
});

export const saveCached = internalMutation({
  args: { provider: v.string(), cacheKey: v.string(), candidatesJson: v.string(), expiresAt: v.number() },
  handler: async (ctx, args) => {
    const prior = await ctx.db.query("cardCatalogCache")
      .withIndex("by_provider_and_cacheKey", (q) => q.eq("provider", args.provider).eq("cacheKey", args.cacheKey))
      .unique();
    const now = Date.now();
    if (prior) return await ctx.db.patch(prior._id, { candidatesJson: args.candidatesJson, expiresAt: args.expiresAt, updatedAt: now });
    return await ctx.db.insert("cardCatalogCache", { ...args, createdAt: now, updatedAt: now });
  },
});

export const lookup = action({
  args: {
    game: v.union(v.literal("pokemon"), v.literal("yugioh")),
    printedCode: v.optional(v.string()),
    setCode: v.optional(v.string()),
    collectorNumber: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ candidates: CardCandidate[]; source: string; cached: boolean }> => {
    const provider = args.game === "yugioh" ? "ygoprodeck" : "pokemontcg";
    const key = cacheKey(args);
    const prior = await ctx.runQuery(internal.cardCatalog.getCached, { provider, cacheKey: key });
    if (prior && prior.expiresAt > Date.now()) {
      const cachedCandidates = JSON.parse(prior.candidatesJson);
      if (Array.isArray(cachedCandidates) && cachedCandidates.length) return { candidates: cachedCandidates, source: provider, cached: true };
    }
    const candidates = args.game === "yugioh" ? await lookupYugioh(args) : await lookupPokemon(args);
    if (candidates.length) await ctx.runMutation(internal.cardCatalog.saveCached, { provider, cacheKey: key, candidatesJson: JSON.stringify(candidates), expiresAt: Date.now() + 12 * 60 * 60 * 1_000 });
    return { candidates, source: provider, cached: false };
  },
});

function requireAdminKey(adminKey: string) {
  const expected = process.env.FLIPTRACKER_ADMIN_KEY;
  if (!expected || adminKey !== expected) throw new Error("Seller access key is incorrect.");
}

export const extractIdentityFromImage = action({
  args: {
    adminKey: v.string(),
    game: v.union(v.literal("pokemon"), v.literal("yugioh")),
    imageDataUrl: v.string(),
  },
  handler: async (_ctx, args): Promise<{ name?: string; printedCode?: string; setCode?: string; collectorNumber?: string; confidence: number; notes?: string }> => {
    requireAdminKey(args.adminKey);
    const match = args.imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new Error("Use a JPEG, PNG, or WebP card photo.");
    if (match[2].length > 8_000_000) throw new Error("Card photo is too large. Choose a smaller image.");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured in Convex.");
    const model = process.env.GEMINI_CARD_MODEL || "gemini-2.5-flash-lite";
    const prompt = args.game === "yugioh"
      ? "Read this Yu-Gi-Oh card. Return strict JSON only with name, printedCode (for example LOB-001), setCode, collectorNumber null, confidence from 0 to 1, and short notes. Do not guess obscured text."
      : "Read this Pokemon card. Return strict JSON only with name, printedCode null, setCode if visible, collectorNumber (for example 123/198), confidence from 0 to 1, and short notes. Do not guess obscured text.";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }] }], generationConfig: { temperature: 0, maxOutputTokens: 300, responseMimeType: "application/json" } }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || `Gemini card request failed (${response.status}).`);
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
    const result = JSON.parse(text);
    return {
      name: normalized(result.name) || undefined,
      printedCode: normalized(result.printedCode) || undefined,
      setCode: normalized(result.setCode) || undefined,
      collectorNumber: normalized(result.collectorNumber) || undefined,
      confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0)),
      notes: normalized(result.notes) || undefined,
    };
  },
});
