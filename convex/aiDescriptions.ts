import { v } from "convex/values";
import { action } from "./_generated/server";

type OpenAiPayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
  promptFeedback?: { blockReason?: string };
};

type ListingDraftPayload = {
  title?: unknown;
  description?: unknown;
  confidence?: unknown;
  warnings?: unknown;
};

type AiProvider = "gemini" | "openai";

const LISTING_INSTRUCTIONS = [
  "Write concise, buyer-ready eBay listing copy for the supplied media item.",
  "Return only the description in plain text, using two or three short paragraphs and no markdown heading.",
  "Use only supplied facts. Never invent testing, authenticity, included parts, edition details, condition, or provenance.",
  "Treat item disclosures and buyer-relevant condition notes as important facts and state them clearly.",
  "Internal notes are context only. Include a note only when it describes a buyer-relevant physical condition or missing component.",
  "Never expose storage/bin locations, acquisition source, purchase price, profit, workflow reminders, private names, or contact details.",
  "If facts conflict, prefer item disclosures and internal condition notes over older description text.",
  "Do not mention AI, pricing research, shipping promises, returns, or eBay policy.",
].join(" ");

const PREPARATION_INSTRUCTIONS = [
  "Prepare truthful, buyer-ready eBay listing copy from supplied item facts.",
  "Return strict JSON only with title, description, confidence, and warnings.",
  "The title must be 80 characters or fewer and lead with useful identity, edition, format, and condition details that are explicitly supplied.",
  "The description must use two or three short plain-text paragraphs with no markdown heading.",
  "Confidence must be a number from 0 to 1. Warnings must be an array of zero to four short seller-review notes.",
  "Use only supplied facts. Never invent testing, authenticity, included parts, edition, rarity, condition, provenance, or specifications.",
  "Do not expose storage locations, cost, profit, workflow notes, private names, or contact details.",
  "When facts are incomplete, keep the language neutral and add a warning instead of guessing.",
].join(" ");

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured in Convex.`);
  return value;
}

function requireAdminKey(adminKey: string) {
  const expected = requiredEnv("FLIPTRACKER_ADMIN_KEY");
  if (!adminKey || adminKey !== expected) throw new Error("Seller access key is incorrect.");
}

function openAiText(payload: OpenAiPayload) {
  if (payload.output_text?.trim()) return payload.output_text.trim();
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text!.trim())
    .filter(Boolean)
    .join("\n\n");
}

function geminiText(payload: GeminiPayload) {
  return (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text?.trim() || "")
    .filter(Boolean)
    .join("\n\n");
}

async function safetyIdentifier(adminKey: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(adminKey));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `fliptracker_${hash.slice(0, 32)}`;
}

function boundedFacts(facts: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(facts)
      .filter(([, value]) => Boolean(value?.trim()))
      .map(([key, value]) => {
        const longerContext = ["existingDescription", "itemDisclosures", "internalNotes"].includes(key);
        return [key, value!.trim().slice(0, longerContext ? 4_000 : 1_000)];
      }),
  );
}

function buyerRelevantNotes(value?: string) {
  if (!value?.trim()) return undefined;
  const conditionTerms = /\b(scratch|scuff|crack|tear|wear|damage|missing|include|disc|disk|case|manual|insert|cover|library|writing|mark|stain|test|seal|new|condition|complete|loose|edition|language|smoke|odor)\w*\b/i;
  const privateTerms = /\b(paid|purchase price|cost|profit|margin|source|sourced|bought|bin|storage|shelf|phone|email|address|customer|buyer)\b/i;
  const safeStatements = (value.match(/[^.!?\n]+[.!?]?/g) || [])
    .map((statement) => statement.trim())
    .filter((statement) => statement && conditionTerms.test(statement) && !privateTerms.test(statement));
  return safeStatements.join(" ") || undefined;
}

function selectedProvider(): AiProvider {
  const configured = process.env.AI_DESCRIPTION_PROVIDER?.trim().toLowerCase();
  if (configured && configured !== "gemini" && configured !== "openai") {
    throw new Error("AI_DESCRIPTION_PROVIDER must be gemini or openai.");
  }
  if (configured) return configured as AiProvider;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new Error("AI descriptions are not configured. Add GEMINI_API_KEY or OPENAI_API_KEY in Convex.");
}

async function generateWithOpenAi(input: string, adminKey: string) {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_DESCRIPTION_MODEL || "gpt-5.6-luna";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "none" },
      text: { verbosity: "low" },
      max_output_tokens: 500,
      safety_identifier: await safetyIdentifier(adminKey),
      instructions: LISTING_INSTRUCTIONS,
      input,
    }),
  });
  const payload = (await response.json()) as OpenAiPayload;
  if (!response.ok) throw new Error(payload.error?.message || `OpenAI description request failed (${response.status}).`);
  const text = openAiText(payload);
  if (!text) throw new Error("OpenAI returned an empty description. Please try again.");
  return { text, model, provider: "openai" as const };
}

async function generateWithGemini(input: string) {
  const apiKey = requiredEnv("GEMINI_API_KEY");
  const model = process.env.GEMINI_DESCRIPTION_MODEL || "gemini-2.5-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: LISTING_INSTRUCTIONS }] },
        contents: [{ role: "user", parts: [{ text: input }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
      }),
    },
  );
  const payload = (await response.json()) as GeminiPayload;
  if (!response.ok) throw new Error(payload.error?.message || `Gemini description request failed (${response.status}).`);
  const text = geminiText(payload);
  if (!text) {
    const reason = payload.promptFeedback?.blockReason;
    throw new Error(reason ? `Gemini did not generate a description (${reason}).` : "Gemini returned an empty description. Please try again.");
  }
  return { text, model, provider: "gemini" as const };
}

function parseListingDraft(text: string, fallbackTitle: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let payload: ListingDraftPayload;
  try {
    payload = JSON.parse(cleaned) as ListingDraftPayload;
  } catch {
    throw new Error("The AI response could not be reviewed safely. Try Smart Prepare again.");
  }
  const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 80) : fallbackTitle.trim().slice(0, 80);
  const description = typeof payload.description === "string" ? payload.description.trim().slice(0, 8_000) : "";
  const rawConfidence = typeof payload.confidence === "number" ? payload.confidence : Number(payload.confidence);
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : 0.5;
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.filter((warning): warning is string => typeof warning === "string").map((warning) => warning.trim().slice(0, 240)).filter(Boolean).slice(0, 4)
    : [];
  if (!title || !description) throw new Error("The AI did not return complete listing copy. Try Smart Prepare again.");
  return { title, description, confidence, warnings };
}

async function prepareWithOpenAi(input: string, adminKey: string) {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_DESCRIPTION_MODEL || "gpt-5.6-luna";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "none" },
      text: { verbosity: "low" },
      max_output_tokens: 750,
      safety_identifier: await safetyIdentifier(adminKey),
      instructions: PREPARATION_INSTRUCTIONS,
      input,
    }),
  });
  const payload = (await response.json()) as OpenAiPayload;
  if (!response.ok) throw new Error(payload.error?.message || `OpenAI preparation request failed (${response.status}).`);
  const text = openAiText(payload);
  if (!text) throw new Error("OpenAI returned an empty preparation. Please try again.");
  return { text, model, provider: "openai" as const };
}

async function prepareWithGemini(input: string) {
  const apiKey = requiredEnv("GEMINI_API_KEY");
  const model = process.env.GEMINI_DESCRIPTION_MODEL || "gemini-2.5-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: PREPARATION_INSTRUCTIONS }] },
        contents: [{ role: "user", parts: [{ text: input }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 750, responseMimeType: "application/json" },
      }),
    },
  );
  const payload = (await response.json()) as GeminiPayload;
  if (!response.ok) throw new Error(payload.error?.message || `Gemini preparation request failed (${response.status}).`);
  const text = geminiText(payload);
  if (!text) {
    const reason = payload.promptFeedback?.blockReason;
    throw new Error(reason ? `Gemini did not prepare the listing (${reason}).` : "Gemini returned an empty preparation. Please try again.");
  }
  return { text, model, provider: "gemini" as const };
}

export const generateListingCopy = action({
  args: {
    adminKey: v.string(),
    title: v.string(),
    type: v.optional(v.string()),
    mediaFormat: v.optional(v.string()),
    edition: v.optional(v.string()),
    releaseYear: v.optional(v.string()),
    studio: v.optional(v.string()),
    author: v.optional(v.string()),
    rating: v.optional(v.string()),
    barcode: v.optional(v.string()),
    condition: v.optional(v.string()),
    completeness: v.optional(v.string()),
    language: v.optional(v.string()),
    itemSpecifics: v.optional(v.string()),
    existingDescription: v.optional(v.string()),
    itemDisclosures: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
  },
  returns: v.object({ text: v.string(), model: v.string(), provider: v.union(v.literal("gemini"), v.literal("openai")) }),
  handler: async (_ctx, args) => {
    requireAdminKey(args.adminKey);
    const { adminKey: _adminKey, ...rawItemFacts } = args;
    const itemFacts = boundedFacts({ ...rawItemFacts, internalNotes: buyerRelevantNotes(args.internalNotes) });
    const input = `Create a truthful listing description from this JSON:\n${JSON.stringify(itemFacts, null, 2)}`;
    return selectedProvider() === "gemini"
      ? await generateWithGemini(input)
      : await generateWithOpenAi(input, args.adminKey);
  },
});

export const prepareListingCopy = action({
  args: {
    adminKey: v.string(),
    title: v.string(),
    assetTitle: v.optional(v.string()),
    type: v.optional(v.string()),
    mediaFormat: v.optional(v.string()),
    author: v.optional(v.string()),
    barcode: v.optional(v.string()),
    condition: v.optional(v.string()),
    completeness: v.optional(v.string()),
    language: v.optional(v.string()),
    itemSpecifics: v.optional(v.string()),
    existingDescription: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    cardGame: v.optional(v.string()),
    cardSet: v.optional(v.string()),
    cardNumber: v.optional(v.string()),
  },
  returns: v.object({
    title: v.string(),
    description: v.string(),
    confidence: v.number(),
    warnings: v.array(v.string()),
    model: v.string(),
    provider: v.union(v.literal("gemini"), v.literal("openai")),
  }),
  handler: async (_ctx, args) => {
    requireAdminKey(args.adminKey);
    const { adminKey: _adminKey, ...rawFacts } = args;
    const facts = boundedFacts({ ...rawFacts, internalNotes: buyerRelevantNotes(args.internalNotes) });
    const input = `Prepare a listing draft from this JSON:\n${JSON.stringify(facts, null, 2)}`;
    const generated = selectedProvider() === "gemini"
      ? await prepareWithGemini(input)
      : await prepareWithOpenAi(input, args.adminKey);
    return { ...parseListingDraft(generated.text, args.title), model: generated.model, provider: generated.provider };
  },
});
