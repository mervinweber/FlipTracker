import { v } from "convex/values";
import { action } from "./_generated/server";

type LookupResult = {
  barcode: string;
  barcodeType: string;
  title: string;
  type: string;
  mediaFormat: string;
  edition?: string;
  releaseYear?: string;
  releaseDate?: string;
  studio?: string;
  author?: string;
  rating?: string;
  coverImageUrl?: string;
  source: string;
  confidence: string;
  notes?: string;
};

function cleanBarcode(value: string) {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function isbnAliases(value: string) {
  const aliases = [value];
  if (/^\d{9}[\dX]$/.test(value)) {
    const stem = `978${value.slice(0, 9)}`;
    const sum = [...stem].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    aliases.push(`${stem}${(10 - (sum % 10)) % 10}`);
  } else if (/^978\d{10}$/.test(value)) {
    const stem = value.slice(3, 12);
    const sum = [...stem].reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
    const check = (11 - (sum % 11)) % 11;
    aliases.push(`${stem}${check === 10 ? "X" : check}`);
  }
  return [...new Set(aliases)];
}

async function fetchJson(url: string, timeoutMs = 6_000): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "FlipTracker/0.6" },
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function httpsImage(value: unknown) {
  const url = typeof value === "string" ? value.trim() : "";
  if (!url || /(?:no[_-]?image|placeholder|default[_-]?(?:cover|image))/i.test(url)) return undefined;
  return url.replace(/^http:\/\//i, "https://");
}

function isbnImage(value: unknown, barcode: string) {
  const url = httpsImage(value);
  if (!url) return undefined;
  const identifiers = url.match(/(?:97[89]\d{10}|\d{9}[\dX])/gi) || [];
  if (identifiers.length && !identifiers.some((identifier) => isbnAliases(barcode).includes(identifier.toUpperCase()))) {
    return undefined;
  }
  return url;
}

function barcodeType(value: string) {
  if (/^[0-9]{12}$/.test(value)) return "UPC-A";
  if (/^[0-9]{8}$/.test(value)) return "EAN-8";
  if (/^[0-9]{13}$/.test(value)) return "EAN-13 / ISBN-13";
  if (/^[0-9]{9}[0-9X]$/.test(value)) return "ISBN-10";
  return "Unknown";
}

function isLikelyBook(value: string) {
  return /^[0-9]{9}[0-9X]$/.test(value) || /^97[89][0-9]{10}$/.test(value);
}

function inferFormat(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("blu-ray") || lower.includes("bluray")) return { type: "Blu-ray", mediaFormat: "Blu-ray" };
  if (lower.includes("dvd")) return { type: "DVD", mediaFormat: "DVD" };
  if (lower.includes("cd") || lower.includes("audio")) return { type: "CD", mediaFormat: "CD" };
  if (lower.includes("book") || lower.includes("paperback") || lower.includes("hardcover")) return { type: "Book", mediaFormat: "Book" };
  return { type: "Other Media", mediaFormat: "Unknown" };
}

function yearFromDate(value?: string) {
  const match = value?.match(/(19|20)\d{2}/);
  return match?.[0];
}

async function lookupOpenLibrary(barcode: string): Promise<LookupResult | null> {
  const aliases = isbnAliases(barcode);
  let bookData: any = null;
  let data: any = null;
  const bookKeys = aliases.map((isbn) => `ISBN:${isbn}`).join(",");
  const [bookResponse, ...editionResponses] = await Promise.all([
    fetchJson(`https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(bookKeys)}&format=json&jscmd=data`),
    ...aliases.map((isbn) => fetchJson(`https://openlibrary.org/isbn/${isbn}.json`)),
  ]);
  bookData = aliases.map((isbn) => bookResponse?.[`ISBN:${isbn}`]).find(Boolean) || null;
  data = editionResponses.find((edition) => edition?.title) || null;

  let searchData: any = null;
  if (!data?.title && !bookData?.title) {
    const searches = await Promise.all(aliases.map((isbn) => fetchJson(
        `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&fields=key,title,author_name,first_publish_year,cover_i,isbn,publisher&limit=3`,
      )));
    searchData = searches
      .map((search) => Array.isArray(search?.docs) ? search.docs[0] : null)
      .find((result) => result?.title) || null;
  }

  const title = String(data?.title || bookData?.title || searchData?.title || "").trim();
  if (!title) return null;
  const authorNames = Array.isArray(bookData?.authors)
    ? bookData.authors.map((author: { name?: string }) => String(author.name || "").trim())
    : Array.isArray(searchData?.author_name)
      ? searchData.author_name.map((name: unknown) => String(name || "").trim())
      : [];
  if (!authorNames.some(Boolean)) {
    authorNames.push(
      ...(await Promise.all(
        (Array.isArray(data?.authors) ? data.authors : []).slice(0, 5).map(async (author: { key?: string }) => {
          if (!author?.key) return "";
          const authorData = await fetchJson(`https://openlibrary.org${author.key}.json`);
          return String(authorData?.name || "").trim();
        }),
      )),
    );
  }
  if (!authorNames.some(Boolean) && data?.by_statement) {
    const creditedAuthor = String(data.by_statement)
      .replace(/^by\s+/i, "")
      .replace(/[.;,\s]+$/, "")
      .trim();
    if (creditedAuthor) authorNames.push(creditedAuthor);
  }
  const publishDate = data?.publish_date || bookData?.publish_date || searchData?.first_publish_year;
  const publisher = Array.isArray(data?.publishers)
    ? data.publishers[0]
    : Array.isArray(bookData?.publishers)
      ? bookData.publishers[0]?.name
      : Array.isArray(searchData?.publisher)
        ? searchData.publisher[0]
        : undefined;
  const coverId = (Array.isArray(data?.covers) ? data.covers : []).find((id: unknown) => Number(id) > 0)
    || (Number(searchData?.cover_i) > 0 ? searchData.cover_i : undefined);
  const coverImageUrl = httpsImage(bookData?.cover?.large || bookData?.cover?.medium)
    || (coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false` : undefined);
  return {
    barcode,
    barcodeType: barcodeType(barcode),
    title,
    type: "Book",
    mediaFormat: data?.physical_format ? String(data.physical_format) : "Book",
    edition: data?.edition_name ? String(data.edition_name) : undefined,
    releaseDate: publishDate ? String(publishDate) : undefined,
    releaseYear: yearFromDate(publishDate ? String(publishDate) : undefined),
    studio: publisher ? String(publisher) : undefined,
    author: authorNames.filter(Boolean).join(", ") || undefined,
    coverImageUrl,
    source: "Open Library",
    confidence: data || bookData ? "High" : "Medium",
    notes: coverImageUrl ? undefined : "Book metadata matched, but Open Library has no cover for this edition.",
  };
}

async function lookupGoogleBooks(barcode: string): Promise<LookupResult | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (!apiKey) return null;
  for (const isbn of isbnAliases(barcode)) {
    const response = await fetchJson(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=5&printType=books&key=${encodeURIComponent(apiKey)}`,
    );
    const item = Array.isArray(response?.items) ? response.items[0] : null;
    const info = item?.volumeInfo;
    if (!info?.title) continue;
    const images = info.imageLinks || {};
    const coverImageUrl = httpsImage(images.extraLarge || images.large || images.medium || images.small || images.thumbnail || images.smallThumbnail);
    return {
      barcode,
      barcodeType: barcodeType(barcode),
      title: String(info.title).trim(),
      type: "Book",
      mediaFormat: String(info.printType || "Book"),
      edition: info.subtitle ? String(info.subtitle) : undefined,
      releaseDate: info.publishedDate ? String(info.publishedDate) : undefined,
      releaseYear: yearFromDate(info.publishedDate ? String(info.publishedDate) : undefined),
      studio: info.publisher ? String(info.publisher) : undefined,
      author: Array.isArray(info.authors) ? info.authors.map(String).join(", ") : undefined,
      rating: info.averageRating ? String(info.averageRating) : undefined,
      coverImageUrl,
      source: "Google Books",
      confidence: "High",
      notes: coverImageUrl ? undefined : "Google Books matched this ISBN but does not provide a cover image.",
    };
  }
  return null;
}

async function lookupUpcItemDb(barcode: string): Promise<LookupResult | null> {
  const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`, {
    headers: { "user-agent": "FlipTracker/0.5" },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const item = Array.isArray(data.items) ? data.items[0] : null;
  if (!item?.title) return null;
  const title = String(item.title).trim();
  const text = [title, item.description, item.category].filter(Boolean).join(" ");
  const inferred = isLikelyBook(barcode) ? { type: "Book", mediaFormat: "Book" } : inferFormat(text);
  const bookAuthor = isLikelyBook(barcode)
    ? title.match(/\bby\s+(.+?)(?:\s*\((?:paperback|hardcover|mass market|book)\)|$)/i)?.[1]?.trim()
    : undefined;
  const bookFormat = isLikelyBook(barcode)
    ? title.match(/\((paperback|hardcover|mass market paperback)\)/i)?.[1]
    : undefined;
  const image = Array.isArray(item.images)
    ? item.images.map((candidate: unknown) => isLikelyBook(barcode) ? isbnImage(candidate, barcode) : httpsImage(candidate)).find(Boolean)
    : undefined;
  return {
    barcode,
    barcodeType: barcodeType(barcode),
    title,
    type: inferred.type,
    mediaFormat: bookFormat || inferred.mediaFormat,
    releaseYear: yearFromDate(String(item.release_date || item.description || "")),
    releaseDate: item.release_date ? String(item.release_date) : undefined,
    studio: item.brand ? String(item.brand) : undefined,
    author: bookAuthor,
    coverImageUrl: image,
    source: "UPCItemDB Trial",
    confidence: inferred.mediaFormat === "Unknown" ? "Medium" : "High",
    notes: inferred.mediaFormat === "Unknown"
      ? "Review media format before saving."
      : isLikelyBook(barcode) && !image
        ? "Book metadata matched, but this provider has no usable cover image."
        : undefined,
  };
}

export const lookupByBarcode = action({
  args: { barcode: v.string() },
  handler: async (_ctx, args): Promise<LookupResult> => {
    const barcode = cleanBarcode(args.barcode);
    if (!barcode) throw new Error("Enter or scan a barcode first.");

    const book = isLikelyBook(barcode) ? await lookupOpenLibrary(barcode) : null;
    if (book?.coverImageUrl) return book;
    const googleBook = isLikelyBook(barcode) ? await lookupGoogleBooks(barcode) : null;
    if (book && googleBook) {
      return {
        ...book,
        edition: book.edition || googleBook.edition,
        releaseYear: book.releaseYear || googleBook.releaseYear,
        releaseDate: book.releaseDate || googleBook.releaseDate,
        studio: book.studio || googleBook.studio,
        author: book.author || googleBook.author,
        rating: book.rating || googleBook.rating,
        coverImageUrl: googleBook.coverImageUrl,
        source: "Open Library + Google Books",
        notes: googleBook.coverImageUrl ? undefined : book.notes || googleBook.notes,
      };
    }
    if (book) return book;
    if (googleBook) return googleBook;

    const upc = await lookupUpcItemDb(barcode);
    if (upc) return upc;

    return {
      barcode,
      barcodeType: barcodeType(barcode),
      title: `Unknown item ${barcode}`,
      type: "Other Media",
      mediaFormat: "Unknown",
      source: "Manual Review",
      confidence: "Low",
      notes: "No metadata match found. Confirm title, edition, and format before saving.",
    };
  },
});

type PhotoLotItem = {
  title: string;
  console?: string;
  edition?: string;
  releaseYear?: string;
  visibleBarcode?: string;
  ebayTitle: string;
  ebayDescription: string;
  estimatedLow?: number;
  estimatedHigh?: number;
  suggestedListPrice?: number;
  confidence: number;
  reviewNotes?: string;
};

function requirePhotoLotAccess(adminKey: string) {
  const expected = process.env.FLIPTRACKER_ADMIN_KEY;
  if (!expected || adminKey !== expected) throw new Error("Seller access key is incorrect.");
}

function optionalString(value: unknown, maxLength = 500) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, maxLength) : undefined;
}

function optionalMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : undefined;
}

export const identifyVideoGameLot = action({
  args: {
    adminKey: v.string(),
    imageDataUrl: v.string(),
    expectedCount: v.number(),
    condition: v.string(),
    completeness: v.string(),
  },
  handler: async (_ctx, args): Promise<{ items: PhotoLotItem[]; notes?: string }> => {
    requirePhotoLotAccess(args.adminKey);
    const expectedCount = Math.max(1, Math.min(12, Math.round(args.expectedCount)));
    const match = args.imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new Error("Use a JPEG, PNG, or WebP lot photo.");
    if (match[2].length > 8_000_000) throw new Error("The lot photo is too large. Choose a smaller image.");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured in Convex.");
    const model = process.env.GEMINI_MEDIA_MODEL || process.env.GEMINI_CARD_MODEL || "gemini-2.5-flash-lite";
    const prompt = [
      `Identify the ${expectedCount} physical video games visible in this reseller intake photo.`,
      `The seller reports condition ${JSON.stringify(args.condition)} and completeness ${JSON.stringify(args.completeness)}.`,
      "Return strict JSON with an items array in left-to-right, top-to-bottom photo order and an optional notes string.",
      "Each item must contain title, console, edition, releaseYear, visibleBarcode, ebayTitle, ebayDescription, estimatedLow, estimatedHigh, suggestedListPrice, confidence, and reviewNotes.",
      "Use null for facts that are not readable. Do not invent a barcode, edition, release year, included manual, testing result, or condition detail.",
      "ebayTitle must be buyer-searchable and no more than 80 characters. ebayDescription must be concise plain text based only on visible/supplied facts and must tell the seller to add exact condition details after inspection.",
      "Price fields are rough pre-comp US-dollar working estimates for a complete used copy, not verified sold comps. Use conservative whole-dollar values and lower confidence when the exact title or edition is uncertain.",
      "If fewer items can be identified confidently, still return one row for each visible case and explain uncertainty in reviewNotes.",
    ].join(" ");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2500, responseMimeType: "application/json" },
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || `Gemini lot request failed (${response.status}).`);
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
    let parsed: { items?: unknown[]; notes?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI returned an unreadable lot result. Retake a clearer photo and try again.");
    }
    if (!Array.isArray(parsed.items) || !parsed.items.length) throw new Error("No games were identified. Retake the photo with every front cover readable.");
    const items = parsed.items.slice(0, 12).map((raw, index) => {
      const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const title = optionalString(item.title, 160) || `Unidentified game ${index + 1}`;
      const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0));
      return {
        title,
        console: optionalString(item.console, 80),
        edition: optionalString(item.edition, 100),
        releaseYear: optionalString(item.releaseYear, 12),
        visibleBarcode: optionalString(item.visibleBarcode, 32)?.replace(/[^0-9X]/gi, ""),
        ebayTitle: (optionalString(item.ebayTitle, 80) || [title, optionalString(item.console, 80)].filter(Boolean).join(" ")).slice(0, 80),
        ebayDescription: optionalString(item.ebayDescription, 2_500) || `${title}. Condition: ${args.condition}. Completeness: ${args.completeness}. Review photos and add exact condition details before publishing.`,
        estimatedLow: optionalMoney(item.estimatedLow),
        estimatedHigh: optionalMoney(item.estimatedHigh),
        suggestedListPrice: optionalMoney(item.suggestedListPrice),
        confidence,
        reviewNotes: optionalString(item.reviewNotes, 500),
      };
    });
    return { items, notes: optionalString(parsed.notes, 800) };
  },
});
