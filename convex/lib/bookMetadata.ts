export type BookMetadata = {
  title: string;
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

export function completeBookTitle(title: string, subtitle?: string) {
  const catalogTitle = title.replace(/\s+/g, " ").replace(/\s+:\s+/g, ": ").trim();
  const cleanTitle = catalogTitle.length > 90 && catalogTitle.includes(":")
    ? catalogTitle.split(":", 1)[0].replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    : catalogTitle;
  const cleanSubtitle = String(subtitle || "").replace(/\s+/g, " ").trim();
  if (!cleanSubtitle || cleanSubtitle.startsWith("/") || cleanTitle.toLowerCase().includes(cleanSubtitle.toLowerCase())) return cleanTitle;
  return `${cleanTitle}: ${cleanSubtitle}`;
}

export function primaryAuthorsFromResponsibility(value?: string) {
  const responsibility = String(value || "").replace(/\s+/g, " ").trim();
  if (!responsibility.startsWith("/")) return [];
  return responsibility
    .slice(1)
    .split(";", 1)[0]
    .replace(/,?\s+(?:storyteller(?:s)?|author(?:s)?|writer(?:s)?|artist(?:s)?|illustrator(?:s)?)\.?\s*$/i, "")
    .split(/\s*(?:&|\band\b)\s*/i)
    .map((name) => name.trim())
    .filter(Boolean);
}

function titleScore(title: string) {
  const normalized = title.trim();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  let score = Math.min(normalized.length, 80);
  if (/\bvol(?:ume)?\.?\s*\d+/i.test(normalized)) score += 24;
  if (/\b(?:new 52|edition|year|city|owls|knight)\b/i.test(normalized)) score += 8;
  if (wordCount <= 1) score -= 45;
  if (normalized.length > 90) score -= 90;
  if (/\s:\s.*\s:\s/i.test(normalized)) score -= 18;
  return score;
}

export function mergeBookMetadata<T extends BookMetadata>(openLibrary: T | null, googleBooks: T | null): T | null {
  if (!openLibrary) return googleBooks;
  if (!googleBooks) return openLibrary;
  const preferred = titleScore(googleBooks.title) >= titleScore(openLibrary.title) ? googleBooks : openLibrary;
  const fallback = preferred === googleBooks ? openLibrary : googleBooks;
  return {
    ...fallback,
    ...preferred,
    edition: preferred.edition || fallback.edition,
    releaseYear: preferred.releaseYear || fallback.releaseYear,
    releaseDate: preferred.releaseDate || fallback.releaseDate,
    studio: preferred.studio || fallback.studio,
    author: preferred.author || fallback.author,
    rating: preferred.rating || fallback.rating,
    coverImageUrl: preferred.coverImageUrl || fallback.coverImageUrl,
    source: "Open Library + Google Books",
    confidence: preferred.confidence === "High" || fallback.confidence === "High" ? "High" : preferred.confidence,
    notes: preferred.coverImageUrl || fallback.coverImageUrl ? undefined : preferred.notes || fallback.notes,
  };
}
