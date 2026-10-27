import * as cheerio from "cheerio";
import type { Grant } from "@/lib/types";
import { inferTopics, sleep } from "@/lib/sources/camcom";

// Contributi Europa (WordPress): il custom post type "bandi" è esposto dall'API REST
// con i campi ACF (scadenza, data_inizio, descrizioni). Le tassonomie (regione,
// beneficiari, agevolazione) arrivano come slug in class_list.
const API = "https://www.contributieuropa.com/wp-json/wp/v2";
const SOURCE = "Contributi Europa";
const USER_AGENT = "BandiMatch/1.0 (+matching bandi-clienti)";
// shortcut: legge solo i bandi pubblicati negli ultimi 2 anni (~35 pagine); i bandi a sportello più vecchi sfuggono, allargare se servono.
const LOOKBACK_DAYS = 730;
const MAX_PAGES = 60;

// Le aree "nazionali" del sito valgono per tutto il territorio.
const NATIONAL_SLUGS = new Set(["italia", "italia-eu", "tutte"]);
// Nomi del sito -> nomi usati nelle anagrafiche clienti.
const REGION_NAMES: Record<string, string> = {
  "friuli-venezia-giulia": "Friuli Venezia Giulia",
  "trentino-alto-adige": "Trentino-Alto Adige",
};

export type WpBando = {
  id: number;
  link: string;
  modified_gmt: string;
  class_list: string[];
  acf: Record<string, unknown>;
};

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Contributi Europa HTTP ${response.status} (${url})`);
  return { data: (await response.json()) as T, totalPages: Number(response.headers.get("x-wp-totalpages")) || 1 };
}

function htmlText(value: unknown) {
  return typeof value === "string" && value ? cheerio.load(value).text().replace(/\s+/g, " ").trim() : "";
}

function terms(classList: string[], taxonomy: string) {
  const prefix = `${taxonomy}-`;
  return classList.filter((c) => c.startsWith(prefix)).map((c) => c.slice(prefix.length));
}

function mapSizes(beneficiari: string[]) {
  const sizes = new Set<string>();
  for (const b of beneficiari) {
    if (b === "pmi") ["Micro", "Piccola", "Media"].forEach((s) => sizes.add(s));
    else if (b === "micro-impresa") sizes.add("Micro");
    else if (b === "grande-impresa") sizes.add("Grande");
    else sizes.add(b.replace(/-/g, " ")); // enti pubblici, terzo settore, persone fisiche: non matchano le imprese
  }
  return sizes.size ? [...sizes] : ["*"];
}

const isoDate = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);

/** Converte un bando WP in Grant; null se chiuso o scaduto. regionNames: slug regione -> nome. */
export function mapBando(b: WpBando, regionNames: Map<string, string>, today: string): Grant | null {
  const a = b.acf;
  const statusText = String(a.scadenza_testo ?? "");
  const deadline = isoDate(a.scadenza);
  const opening = isoDate(a.data_inizio);
  if (/chiusi/i.test(statusText) || (deadline && deadline < today)) return null;

  const areas = terms(b.class_list, "area_geografica");
  const national = areas.some((s) => NATIONAL_SLUGS.has(s));
  const regions = national
    ? ["ITALIA"]
    : areas.flatMap((s) => (regionNames.has(s) ? [REGION_NAMES[s] ?? regionNames.get(s)!] : []));

  const description = [
    a.descrizione_bando, a.descrizione_soggetti, a.descrizione_tipologia_ammissibili, a.descrizione_forma_agevolazione,
  ].map(htmlText).filter(Boolean).join("\n\n");
  const title = String(a.titolo_completo || a.oggetto_messaggio_email || b.link);
  const settori = terms(b.class_list, "settore").map((s) => s.replace(/-/g, " "));

  return {
    id: `CEUROPA-${b.id}`,
    title,
    ente: null,
    level: national ? "Nazionale" : "Regionale/locale",
    status: /prossima apertura/i.test(statusText) || (opening && opening > today) ? "In arrivo" : "Aperto",
    regions: regions.length ? regions : ["ITALIA"],
    sizes: mapSizes(terms(b.class_list, "beneficiari")),
    ateco_filter: ["*"],
    topics: inferTopics([title, description, ...settori].join(" ; ")),
    invest_min_eur: null,
    invest_max_eur: null,
    opening_date: opening,
    deadline,
    aid_type: terms(b.class_list, "agevolazione").map((s) => s.replace(/-/g, " ")).join(", ") || null,
    budget: null,
    url: String(a.link_documentazione_ufficiale || b.link),
    source: SOURCE,
    source_updated_at: b.modified_gmt ? `${b.modified_gmt}Z` : null,
    requirements: description.slice(0, 6000) || "Verificare i requisiti sulla pagina ufficiale del bando.",
    raw: {
      link: b.link,
      scadenza_testo: statusText,
      modalita_presentazione: a.modalita_presentazione,
      livello_difficolta: a.livello_difficolta,
      documenti: a.elenco_sintetico_documenti,
      settori,
    },
    synced_at: new Date().toISOString(),
  };
}

export async function fetchContributiEuropa(): Promise<Grant[]> {
  const delayMs = Math.max(0, Number(process.env.CAMCOM_LG_DELAY_MS ?? 400));
  const today = new Date().toISOString().slice(0, 10);
  const after = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 19);

  const { data: areas } = await fetchJson<{ slug: string; name: string }[]>(
    `${API}/area_geografica?parent=0&per_page=100&_fields=slug,name`
  );
  const regionNames = new Map(areas.map((t) => [t.slug, t.name]));

  const list = `${API}/bandi?per_page=100&orderby=date&order=desc&after=${after}&_fields=id,link,modified_gmt,class_list,acf`;
  const grants = new Map<string, Grant>();
  let totalPages = 1;
  for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
    if (page > 1) await sleep(delayMs);
    const res = await fetchJson<WpBando[]>(`${list}&page=${page}`);
    totalPages = res.totalPages;
    for (const b of res.data) {
      const grant = mapBando(b, regionNames, today);
      if (grant) grants.set(grant.id, grant);
    }
  }
  return [...grants.values()];
}
