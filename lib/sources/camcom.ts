import * as cheerio from "cheerio";
import type { Grant } from "@/lib/types";

// Camere di Commercio sul template Drupal InfoCamere, senza API pubblica:
// la fonte dei dati è la pagina /bandi (elenco paginato) più, opzionalmente,
// le pagine di dettaglio di ogni singolo bando.
export type Chamber = {
  idPrefix: string;
  baseUrl: string;
  ente: string;
  region: string;
  area: string;
  // Camere senza l'elenco /bandi paginato: pagine (o blocchi di pagina) per stato,
  // `links` è il selettore CSS dei link alle schede dei bandi
  // `status` assente: stato dedotto dalla scadenza ("Scade il:" accanto al link)
  sections?: { path: string; status?: string; links: string }[];
};

export const CHAMBERS = {
  "camcom-lg": {
    idPrefix: "CAMCOM-LG",
    baseUrl: "https://www.lg.camcom.it",
    ente: "CCIAA Maremma e Tirreno",
    region: "Toscana",
    area: "nelle province di Livorno e Grosseto",
  },
  "camcom-fi": {
    idPrefix: "CAMCOM-FI",
    baseUrl: "https://www.fi.camcom.gov.it",
    ente: "CCIAA Firenze",
    region: "Toscana",
    area: "nella città metropolitana di Firenze",
  },
  "camcom-bg": {
    idPrefix: "CAMCOM-BG",
    baseUrl: "https://www.bg.camcom.it",
    ente: "CCIAA Bergamo",
    region: "Lombardia",
    area: "in provincia di Bergamo",
  },
  "camcom-tno": {
    idPrefix: "CAMCOM-TNO",
    baseUrl: "https://tno.camcom.it",
    ente: "CCIAA Toscana Nord-Ovest",
    region: "Toscana",
    area: "nelle province di Lucca, Massa-Carrara e Pisa",
    // /bandi è ad accesso negato; i bandi archiviati sono vecchi e non servono
    sections: [
      { path: "/bandi/bandi-aperti", status: "Aperto", links: "td.views-field-title a" },
      { path: "/bandi/bandi-rendicontazione", status: "In rendicontazione", links: "td.views-field-title a" },
    ],
  },
  "camcom-ptpo": {
    idPrefix: "CAMCOM-PTPO",
    baseUrl: "https://www.ptpo.camcom.it",
    ente: "CCIAA Pistoia-Prato",
    region: "Toscana",
    area: "nelle province di Pistoia e Prato",
    // aperti e scaduti nella stessa pagina, in due menu distinti
    sections: [
      { path: "/servizi/contributi/index", status: "Aperto", links: "nav[aria-label='Menù di navigazione contributi camerali'] a" },
      { path: "/servizi/contributi/index", status: "Chiuso", links: "nav[aria-label='Menù di navigazione contributi camerali scaduti'] a" },
    ],
  },
  "camcom-rm": {
    idPrefix: "CAMCOM-RM",
    baseUrl: "https://www.rm.camcom.it",
    ente: "CCIAA Roma",
    region: "Lazio",
    area: "nella città metropolitana di Roma",
    // shortcut: solo la prima pagina (20 avvisi più recenti); i bandi aperti stanno tutti lì, leggere anche ?inizio=20 se un giorno non basta
    sections: [
      { path: "/pagina82_avvisi-pubblici-bandi-per-contributi-e-attivit-promozionali-altre-opportunit.html", links: ".campoOggetto255 a" },
    ],
  },
} satisfies Record<string, Chamber>;

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

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} (${url})`);
  }
  return response.text();
}

/** Converte "30/09/2026", "18-12-2026" o "ore 16:00 del 1/12/2026" -> ISO. Ignora testo aggiuntivo tipo "salvo chiusura anticipata…". */
export function parseSlashDate(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/** Converte "Ven 31 Lug, 2026" o "28 Ottobre 2026" -> "2026-07-31". */
export function parseItalianLongDate(raw: string | null): string | null {
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

const DATE_RE = String.raw`(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}°?\s+[a-zà]+\s+\d{4})`;
const parseAnyDate = (raw: string | undefined) => (raw ? parseSlashDate(raw) ?? parseItalianLongDate(raw) : null);

/** Finestra di presentazione scritta nel testo della scheda, es. "dalle ore 10 del 20 Ottobre 2026 fino alle ore 18 del 26 Ottobre 2026",
 *  "dalle ore 10:00 dell'11/11/2026 e non oltre le ore 23:59 del 30/11/2026", "dal 01/10/2026 al 30/11/2026", "entro il 30/11/2026". */
export function parseDetailDates(text: string | null): { opening: string | null; deadline: string | null } {
  if (!text) return { opening: null, deadline: null };
  // la sezione "Quando presentare domanda", se c'è, evita le date di spese e rendicontazione
  const start = text.search(/quando presentare/i);
  const scope = start >= 0 ? text.slice(start, start + 600) : text;
  const range = scope.match(new RegExp(String.raw`\bdal(?:le|l')?\b.{0,40}?${DATE_RE}.{0,60}?${DATE_RE}`, "i"));
  if (range) return { opening: parseAnyDate(range[1]), deadline: parseAnyDate(range[2]) };
  const until = scope.match(new RegExp(String.raw`\b(?:entro|non oltre|fino al)\b.{0,30}?${DATE_RE}`, "i"));
  return { opening: null, deadline: parseAnyDate(until?.[1]) };
}

function normalizeStatus(raw: string | null, deadline: string | null): {
  status: Grant["status"];
  originalLabel: string | null;
} {
  const value = (raw ?? "").trim();
  const lower = value.toLocaleLowerCase("it-IT");

  if (lower.includes("prossima apertura")) {
    return { status: "In arrivo", originalLabel: "Di prossima apertura" };
  }
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

export function inferTopics(text: string): string[] {
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

function extractListingPage($: cheerio.CheerioAPI, chamber: Chamber): ListedBando[] {
  const seen = new Map<string, ListedBando>();
  const host = new URL(chamber.baseUrl).host;

  $(`a[href^='/bandi/'], a[href*='${host}/bandi/']`).each((_, el) => {
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
      text = container.text().replace(/\s+/g, " ");
      if (/scade:/i.test(text) || /\b(aperto|chiuso|rendicontazione)\b/i.test(text)) break;
    }

    const statusRaw = text.match(/\b(Di prossima apertura|Aperto|Chiuso|In rendicontazione)\b/i)?.[0] ?? null;
    // "Scade: <data> ID: <data pubblicazione>"; il formato della scadenza varia per Camera
    const deadlineRaw = text.match(/Scade:\s*(.*?)\s*(?:ID:|$)/i)?.[1] || null;
    const afterId = text.split(/ID:/i)[1] ?? text;
    const publishedRaw = afterId.match(/\b\w{3}\s+\d{1,2}\s+\w{3,4},?\s+\d{4}\b/)?.[0] ?? null;

    seen.set(slug, {
      title,
      url: href.startsWith("http") ? href : `${chamber.baseUrl}${href}`,
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
    return text || null; // intero: le date possono stare in fondo alla pagina; troncato in mapToGrant
  } catch {
    return null; // il dettaglio è un arricchimento facoltativo: non deve bloccare la sync
  }
}

function mapToGrant(item: ListedBando, detailText: string | null, chamber: Chamber): Grant {
  const fromText = parseDetailDates(detailText);
  detailText = detailText?.slice(0, 6000) ?? null;
  const deadline = parseSlashDate(item.deadlineRaw) ?? parseItalianLongDate(item.deadlineRaw) ?? fromText.deadline;
  const normalized = normalizeStatus(item.statusRaw, deadline);
  const originalLabel = normalized.originalLabel;
  const publishedAt = fromText.opening ?? parseSlashDate(item.publishedRaw) ?? parseItalianLongDate(item.publishedRaw);
  const today = new Date().toISOString().slice(0, 10);
  // le pagine "aperti" includono anche i bandi di prossima apertura
  const status = normalized.status === "Aperto" && publishedAt && fromText.opening && publishedAt > today ? "In arrivo" : normalized.status;

  const topicSource = [item.title, detailText ?? ""].join(" ; ");
  const topics = inferTopics(topicSource);

  const requirementsParts = [
    originalLabel && originalLabel !== status
      ? `Stato pubblicato sul sito camerale: ${originalLabel}.`
      : null,
    `Bando camerale riservato alle imprese con sede ${chamber.area}.`,
    detailText ?? "Verificare i requisiti completi sulla pagina ufficiale del bando.",
  ].filter(Boolean);

  return {
    id: `${chamber.idPrefix}-${item.slug.replace(/\//g, "-")}`,
    title: item.title,
    ente: chamber.ente,
    level: "Camerale",
    status,
    regions: [chamber.region],
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
    source: chamber.ente,
    source_updated_at: null,
    requirements: requirementsParts.join(" | "),
    raw: item,
    synced_at: new Date().toISOString(),
  };
}

// Negli elenchi per sezione compaiono anche esiti, graduatorie e avvisi non di contributo
// (iscrizioni a registri ed elenchi, esami): non sono bandi da proporre ai clienti.
export const NOT_A_BANDO =
  /graduatori|provvediment|liquidazion|esit[oi]\b|soggetti attuatori|elenco (?:delle imprese )?(?:ammess|benefic)|riapertura delle iscrizioni|sessioni di esame|(?:iscrizione nell|ampliamento dell)['’]elenco/i;

// I parametri CAMCOM_LG_* valgono per tutte le Camere (nomi storici).
export async function fetchCamCom(chamber: Chamber): Promise<Grant[]> {
  const maxPages = Math.max(1, Number(process.env.CAMCOM_LG_MAX_PAGES ?? 10));
  const fetchDetails = String(process.env.CAMCOM_LG_FETCH_DETAILS ?? "true").toLowerCase() !== "false";
  const delayMs = Math.max(0, Number(process.env.CAMCOM_LG_DELAY_MS ?? 400));

  const bySlug = new Map<string, ListedBando>();

  for (const section of chamber.sections ?? []) {
    const $ = cheerio.load(await fetchHtml(`${chamber.baseUrl}${section.path}`));
    $(section.links).each((_, el) => {
      const href = $(el).attr("href");
      const title = $(el).text().replace(/\s+/g, " ").trim();
      if (!href || !title || NOT_A_BANDO.test(title)) return;
      const url = new URL(href, chamber.baseUrl);
      const slug = url.pathname.replace(/^\/+|\/+$/g, "");
      // il primo antenato con "Scade il:" è il riquadro dell'avviso (Roma); altrove non c'è e restano null
      const box = $(el).parents().filter((_, p) => /scade il:/i.test($(p).text())).first().text();
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          title, url: url.href, slug, statusRaw: section.status ?? null,
          deadlineRaw: box.match(/Scade il:\s*([\d/-]+)/i)?.[1] ?? null,
          publishedRaw: box.match(/Pubblicato il\s*:\s*([\d/-]+)/i)?.[1] ?? null,
        });
      }
    });
    await sleep(delayMs);
  }

  for (let page = 0; !chamber.sections && page < maxPages; page++) {
    const url = `${chamber.baseUrl}/bandi${page > 0 ? `?page=${page}` : ""}`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const found = extractListingPage($, chamber);

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
    // i bandi chiusi non servono al matching: niente dettaglio, sync più veloce
    const wantDetail = fetchDetails && normalizeStatus(item.statusRaw, parseSlashDate(item.deadlineRaw)).status !== "Chiuso";
    const detailText = wantDetail ? await fetchDetailText(item.url) : null;
    grants.push(mapToGrant(item, detailText, chamber));
    if (wantDetail) await sleep(delayMs);
  }

  return grants;
}
