import * as cheerio from "cheerio";
import type { Grant } from "@/lib/types";

// CCIAA Maremma e Tirreno (Livorno + Grosseto). Il sito è un Drupal 9 senza
// API pubblica: la fonte dei dati è la pagina /bandi (elenco paginato) più,
// opzionalmente, le pagine di dettaglio di ogni singolo bando.
const BASE_URL = "https://www.lg.camcom.it";
const ENTE = "CCIAA Maremma e Tirreno";
const USER_AGENT = "BandiMatch/1.0 (+matching bandi-clienti; contatto: imposta CAMCOM_LG_CONTACT)";

const MONTHS_IT: Record<string, string> = {
  gen: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  mag: "05",
  giu: "06",
  lug: "07",
  ago: "08",
  set: "09",
  ott: "10",
  nov: "11",
  dic: "12",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`CCIAA Maremma e Tirreno HTTP ${response.status} (${url})`);
  }
  return response.text();
}

/** Converte "30/09/2026" -> "2026-09-30". Ignora testo aggiuntivo tipo "salvo chiusura anticipata…". */
function parseSlashDate(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/** Converte "Ven 31 Lug, 2026" -> "2026-07-31". */
function parseItalianLongDate(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw
    .toLocaleLowerCase("it-IT")
    .match(/(\d{1,2})\s+([a-zà]{3,4})[a-zà.]*[,\s]+(\d{4})/);
  if (!match) return null;
  const [, day, monthRaw, year] = match;
  const month = MONTHS_IT[monthRaw.slice(0, 3)];
  if (!month) return null;
  const iso = `${year}-${month}-${day.padStart(2, "0")}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

function normalizeStatus(raw: string | null, deadline: string | null): {
  status: Grant["status"];
  originalLabel: string | null;
} {
  const value = (raw ?? "").trim();
  const lower = value.toLocaleLowerCase("it-IT");

  if (lower.includes("rendicontazione")) {
    return { status: "Chiuso", originalLabel: "In rendicontazione" };
  }
  if (lower.includes("chiuso")) {
    return { status: "Chiuso", originalLabel: "Chiuso" };
  }
  if (lower.includes("aperto")) {
    return { status: "Aperto", originalLabel: "Aperto" };
  }

  // fallback se il badge di stato non viene trovato nel markup
  const today = new Date().toISOString().slice(0, 10);
  if (deadline && deadline < today) {
    return { status: "Chiuso", originalLabel: null };
  }
  return { status: "Aperto", originalLabel: null };
}

function inferTopics(text: string): string[] {
  const value = text.toLocaleLowerCase("it-IT");
  const topics = new Set<string>();

  if (value.includes("digital") || value.includes("intelligenza artificiale")) topics.add("digitale");
  if (value.includes("cloud")) topics.add("cloud");
  if (value.includes("cyber") || value.includes("sicurezza informatica")) topics.add("cybersecurity");
  if (
    value.includes("sosteni") ||
    value.includes("green") ||
    value.includes("energ") ||
    value.includes("ambient") ||
    value.includes("circolare")
  ) topics.add("green");
  if (value.includes("ricerca") || value.includes("innovaz")) topics.add("R&S");
  if (value.includes("internazional") || value.includes("export")) topics.add("export");
  if (value.includes("formazione") || value.includes("corso") || value.includes("competenz")) topics.add("formazione");
  if (value.includes("investiment") || value.includes("beni strumentali") || value.includes("macchinar")) {
    topics.add("investimenti");
  }
  if (value.includes("turis")) topics.add("turismo");
  if (value.includes("commercio") || value.includes("vicinato")) topics.add("commercio");
  if (value.includes("qualità") || value.includes("certificazion")) topics.add("certificazioni");
  if (value.includes("nuova impresa") || value.includes("creazione d'impresa") || value.includes("creazione di impresa")) {
    topics.add("creazione impresa");
  }

  return [...topics];
}

type ListedBando = {
  title: string;
  url: string;
  slug: string;
  statusRaw: string | null;
  deadlineRaw: string | null;
  publishedRaw: string | null;
};

function extractListingPage($: cheerio.CheerioAPI): ListedBando[] {
  const seen = new Map<string, ListedBando>();

  $("a[href^='/bandi/'], a[href*='lg.camcom.it/bandi/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const slug = href.split("/bandi/").pop()?.split(/[?#]/)[0];
    if (!slug || slug.length < 3) return; // scarta link tipo "/bandi" o "/bandi/"

    const title = $(el).text().trim();
    if (!title) return;

    if (seen.has(slug)) return; // ogni bando compare 2 volte (immagine + titolo)

    // Il blocco che contiene stato/scadenza/data è un antenato dell'anchor:
    // saliamo di qualche livello finché troviamo "Scade:" o uno stato noto.
    let container = $(el);
    let text = "";
    for (let i = 0; i < 6; i++) {
      container = container.parent();
      if (!container.length) break;
      text = container.text();
      if (/scade:/i.test(text) || /\b(aperto|chiuso|rendicontazione)\b/i.test(text)) break;
    }

    const statusRaw = text.match(/\b(Aperto|Chiuso|In rendicontazione)\b/i)?.[0] ?? null;
    const deadlineRaw = text.match(/Scade:[^\n]*/i)?.[0] ?? null;
    const publishedRaw = text.match(/\b\w{3}\s+\d{1,2}\s+\w{3,4},?\s+\d{4}\b/)?.[0] ?? null;

    seen.set(slug, {
      title,
      url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
      slug,
      statusRaw,
      deadlineRaw,
      publishedRaw,
    });
  });

  return [...seen.values()];
}

async function fetchDetailText(url: string): Promise<string | null> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer").remove();
    const main = $("main, #main-content, .region-content").first();
    const text = (main.length ? main.text() : $("body").text())
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 6000) || null;
  } catch {
    return null; // il dettaglio è un arricchimento facoltativo: non deve bloccare la sync
  }
}

function mapToGrant(item: ListedBando, detailText: string | null): Grant {
  const deadline = parseSlashDate(item.deadlineRaw);
  const { status, originalLabel } = normalizeStatus(item.statusRaw, deadline);
  const publishedAt = parseItalianLongDate(item.publishedRaw);

  const topicSource = [item.title, detailText ?? ""].join(" ; ");
  const topics = inferTopics(topicSource);

  const requirementsParts = [
    originalLabel && originalLabel !== status
      ? `Stato pubblicato sul sito camerale: ${originalLabel}.`
      : null,
    "Bando camerale riservato alle imprese con sede nelle province di Livorno e Grosseto.",
    detailText ?? "Verificare i requisiti completi sulla pagina ufficiale del bando.",
  ].filter(Boolean);

  return {
    id: `CAMCOM-LG-${item.slug}`,
    title: item.title,
    ente: ENTE,
    level: "Camerale",
    status,
    regions: ["Toscana"],
    sizes: ["Micro", "Piccola", "Media"],
    ateco_filter: ["*"],
    topics,
    invest_min_eur: null,
    invest_max_eur: null,
    opening_date: publishedAt,
    deadline,
    aid_type: "Contributo/voucher camerale",
    budget: null,
    url: item.url,
    source: "CCIAA Maremma e Tirreno",
    source_updated_at: null,
    requirements: requirementsParts.join(" | "),
    raw: item,
    synced_at: new Date().toISOString(),
  };
}

export async function fetchCamComLG(): Promise<Grant[]> {
  const maxPages = Math.max(1, Number(process.env.CAMCOM_LG_MAX_PAGES ?? 10));
  const fetchDetails = String(process.env.CAMCOM_LG_FETCH_DETAILS ?? "true").toLowerCase() !== "false";
  const delayMs = Math.max(0, Number(process.env.CAMCOM_LG_DELAY_MS ?? 400));

  const bySlug = new Map<string, ListedBando>();

  for (let page = 0; page < maxPages; page++) {
    const url = `${BASE_URL}/bandi${page > 0 ? `?page=${page}` : ""}`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const found = extractListingPage($);

    let hasNew = false;
    for (const item of found) {
      if (!bySlug.has(item.slug)) {
        bySlug.set(item.slug, item);
        hasNew = true;
      }
    }

    if (!hasNew) break; // pagina vuota o già vista: fine della paginazione
    if (page > 0) await sleep(delayMs);
  }

  const items = [...bySlug.values()];
  const grants: Grant[] = [];

  for (const item of items) {
    const detailText = fetchDetails ? await fetchDetailText(item.url) : null;
    grants.push(mapToGrant(item, detailText));
    if (fetchDetails) await sleep(delayMs);
  }

  return grants;
}
