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
  rating?: string;
  coverImageUrl?: string;
  source: string;
  confidence: string;
  notes?: string;
};

function cleanBarcode(value: string) {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
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
  const response = await fetch(`https://openlibrary.org/isbn/${barcode}.json`);
  if (!response.ok) return null;
  const data = await response.json();
  const title = String(data.title || "").trim();
  if (!title) return null;
  return {
    barcode,
    barcodeType: barcodeType(barcode),
    title,
    type: "Book",
    mediaFormat: data.physical_format ? String(data.physical_format) : "Book",
    edition: data.edition_name ? String(data.edition_name) : undefined,
    releaseDate: data.publish_date ? String(data.publish_date) : undefined,
    releaseYear: yearFromDate(data.publish_date ? String(data.publish_date) : undefined),
    studio: Array.isArray(data.publishers) ? String(data.publishers[0] || "") : undefined,
    coverImageUrl: `https://covers.openlibrary.org/b/isbn/${barcode}-L.jpg`,
    source: "Open Library",
    confidence: "High",
  };
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
  const inferred = inferFormat(text);
  const image = Array.isArray(item.images) ? item.images[0] : undefined;
  return {
    barcode,
    barcodeType: barcodeType(barcode),
    title,
    type: inferred.type,
    mediaFormat: inferred.mediaFormat,
    releaseYear: yearFromDate(String(item.release_date || item.description || "")),
    releaseDate: item.release_date ? String(item.release_date) : undefined,
    studio: item.brand ? String(item.brand) : undefined,
    coverImageUrl: image ? String(image) : undefined,
    source: "UPCItemDB Trial",
    confidence: inferred.mediaFormat === "Unknown" ? "Medium" : "High",
    notes: inferred.mediaFormat === "Unknown" ? "Review media format before saving." : undefined,
  };
}

export const lookupByBarcode = action({
  args: { barcode: v.string() },
  handler: async (_ctx, args): Promise<LookupResult> => {
    const barcode = cleanBarcode(args.barcode);
    if (!barcode) throw new Error("Enter or scan a barcode first.");

    const book = isLikelyBook(barcode) ? await lookupOpenLibrary(barcode) : null;
    if (book) return book;

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
