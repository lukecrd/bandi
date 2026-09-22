import { Band, Client } from "@/lib/types";

const ITALIAN_REGIONS = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
  "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana",
  "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

// Common Italian stopwords plus domain filler words that appear in almost
// every client/band text regardless of real sector affinity (e.g. "impresa",
// "bando"), which would otherwise create false-positive keyword overlaps.
const STOPWORDS = new Set([
  "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "a", "da", "in",
  "con", "su", "per", "tra", "fra", "e", "o", "ma", "che", "chi", "cui", "non",
  "si", "è", "sono", "del", "della", "dei", "delle", "dello", "al", "allo",
  "alla", "ai", "agli", "alle", "nel", "nello", "nella", "nei", "negli",
  "nelle", "come", "più", "anche", "questo", "questa", "questi", "queste",
  "quello", "quella", "suo", "sua", "suoi", "sue", "loro", "essere", "avere",
  "impresa", "imprese", "azienda", "aziende", "società", "attività",
  "settore", "settori", "progetto", "progetti", "bando", "bandi", "avviso",
  "contributo", "contributi", "finanziamento", "finanziamenti", "regione",
  "comune", "ente", "enti", "pubblico", "pubblica", "nazionale", "italia",
  "italiano", "italiana", "misura", "misure",
]);

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function tokenize(value: string | null | undefined): string[] {
  return normalizeText(value)
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !/^\d+$/.test(token) && !STOPWORDS.has(token));
}

function uniqueOverlap(a: string[], b: string[]): string[] {
  const bSet = new Set(b);
  const seen = new Set<string>();
  const overlap: string[] = [];
  for (const token of a) {
    if (seen.has(token)) continue;
    if (bSet.has(token) || b.some((t) => t.includes(token) || token.includes(t))) {
      overlap.push(token);
      seen.add(token);
    }
  }
  return overlap;
}

function bandFullText(band: Band): string {
  return [band.titolo, band.descrizione, band.settore, band.requisiti, band.ente].filter(Boolean).join(" ");
}

function regionMentioned(text: string, region: string): boolean {
  const normalizedText = normalizeText(text).replace(/[^a-z\s]+/g, " ").replace(/\s+/g, " ");
  const normalizedRegion = normalizeText(region).replace(/[^a-z\s]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalizedRegion) return false;
  return new RegExp(`\\b${normalizedRegion.replace(/\s+/g, "\\s+")}\\b`).test(normalizedText);
}

function findMentionedRegion(text: string): string | null {
  return ITALIAN_REGIONS.find((region) => regionMentioned(text, region)) ?? null;
}

const SIZE_KEYWORDS: Record<string, string[]> = {
  micro: ["microimpresa", "micro impresa", "micro-impresa"],
  piccola: ["piccola impresa", "piccole imprese", "pmi"],
  media: ["media impresa", "medie imprese", "pmi", "sme"],
  grande: ["grande impresa", "grandi imprese", "enterprise", "large"],
};

function sizeCategory(taglia: string): keyof typeof SIZE_KEYWORDS | null {
  const normalized = normalizeText(taglia);
  if (normalized.includes("micro")) return "micro";
  if (normalized.includes("piccol")) return "piccola";
  if (normalized.includes("medi")) return "media";
  if (normalized.includes("grand")) return "grande";
  return null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface MatchScoreResult {
  score: number;
  motivazione: string;
}

/**
 * RNA open-data records describe aid already granted (DATA_CONCESSIONE is a
 * concession date, not an application deadline), so a "past" scadenza there
 * carries no signal. Only penalize/reward deadlines for sources that publish
 * genuine open calls.
 */
function hasReliableDeadline(band: Band): boolean {
  return band.source !== "RNA";
}

export function computeMatchScore(client: Client, band: Band): MatchScoreResult {
  let score = 0;
  const reasons: string[] = [];
  const fullText = bandFullText(band);

  // Regione (max 20)
  if (client.regione) {
    if (band.regione && client.regione.toLowerCase() === band.regione.toLowerCase()) {
      score += 20;
      reasons.push(`Allineamento regionale: ${client.regione}`);
    } else if (!band.regione && regionMentioned(fullText, client.regione)) {
      score += 12;
      reasons.push(`Regione ${client.regione} citata nel bando`);
    } else if (band.regione) {
      const mentioned = findMentionedRegion(fullText);
      if (mentioned && mentioned.toLowerCase() === client.regione.toLowerCase()) {
        score += 12;
        reasons.push(`Regione ${client.regione} citata nel bando`);
      }
    }
  }

  // Settore / ATECO (max 30)
  let sectorScore = 0;
  if (client.settore && band.settore && client.settore.toLowerCase() === band.settore.toLowerCase()) {
    sectorScore = 30;
    reasons.push(`Settore coerente: ${client.settore}`);
  } else if (client.settore) {
    const clientSectorTokens = tokenize(client.settore);
    const bandTokens = tokenize(band.settore ? `${band.settore} ${fullText}` : fullText);
    const overlap = uniqueOverlap(clientSectorTokens, bandTokens);
    if (overlap.length > 0) {
      sectorScore = Math.min(10 + overlap.length * 6, 26);
      reasons.push(`Affinità settoriale: ${overlap.slice(0, 4).join(", ")}`);
    }
  }
  if (client.codici_ateco) {
    const atecoCodes = client.codici_ateco
      .split(/[\s,;/]+/)
      .map((code) => code.trim())
      .filter((code) => code.length >= 4);
    const normalizedText = normalizeText(fullText);
    const hit = atecoCodes.find((code) => normalizedText.includes(normalizeText(code)));
    if (hit) {
      sectorScore = Math.min(sectorScore + 8, 30);
      reasons.push(`Codice ATECO ${hit} citato nel bando`);
    }
  }
  score += sectorScore;

  // Taglia aziendale (max 10)
  const sizeCat = client.taglia_aziendale ? sizeCategory(client.taglia_aziendale) : null;
  if (sizeCat) {
    const normalizedText = normalizeText(fullText);
    const matched = SIZE_KEYWORDS[sizeCat].some((kw) => normalizedText.includes(kw));
    if (matched) {
      score += 10;
      reasons.push("Requisiti compatibili con la taglia aziendale");
    }
  }

  // Affinità testuale sui requisiti del cliente (max 20)
  if (client.requisiti) {
    const clientReqTokens = tokenize(client.requisiti);
    const bandTokens = tokenize(fullText);
    const overlap = uniqueOverlap(clientReqTokens, bandTokens);
    if (overlap.length > 0) {
      const reqScore = Math.min(overlap.length * 5, 20);
      score += reqScore;
      reasons.push(`Requisiti comuni: ${overlap.slice(0, 4).join(", ")}`);
    }
  }

  // Scadenza: bonus se imminente, penalità se già scaduta (solo per fonti con vera deadline)
  const deadline = parseDate(band.scadenza);
  if (deadline && hasReliableDeadline(band)) {
    const daysLeft = Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      score = Math.max(0, score - 15);
      reasons.push(`Attenzione: bando probabilmente scaduto (${band.scadenza})`);
    } else if (daysLeft <= 14) {
      score += 10;
      reasons.push(`Scadenza imminente: ${daysLeft} giorni`);
    } else if (daysLeft <= 60) {
      score += 5;
      reasons.push(`Scadenza entro 60 giorni: ${daysLeft} giorni`);
    }
  }

  score = Math.max(0, Math.min(score, 100));

  return {
    score,
    motivazione: reasons.length > 0 ? reasons.join(". ") : "Nessuna corrispondenza rilevante trovata",
  };
}
