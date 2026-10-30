import type { Grant } from "@/lib/types";
import { inferTopics } from "@/lib/sources/camcom";
import { SYNC_SOURCES } from "@/lib/sync-sources";

// Gare d'appalto pubbliche (non finanza agevolata): TED per le gare sopra soglia UE,
// ANAC Pubblicità a Valore Legale (PVL) per tutte le gare italiane. API pubbliche senza chiave.
const USER_AGENT = "BandiMatch/1.0 (+matching bandi-clienti)";

const NUTS2: Record<string, string> = {
  ITC1: "Piemonte", ITC2: "Valle d'Aosta", ITC3: "Liguria", ITC4: "Lombardia",
  ITH1: "Trentino-Alto Adige", ITH2: "Trentino-Alto Adige", ITH3: "Veneto", ITH4: "Friuli Venezia Giulia",
  ITH5: "Emilia-Romagna", ITI1: "Toscana", ITI2: "Umbria", ITI3: "Marche", ITI4: "Lazio",
  ITF1: "Abruzzo", ITF2: "Molise", ITF3: "Campania", ITF4: "Puglia", ITF5: "Basilicata", ITF6: "Calabria",
  ITG1: "Sicilia", ITG2: "Sardegna",
};

// ANAC indica il luogo (luogo_nuts) col nome della provincia, a volte della regione.
const PROVINCES: Record<string, string> = {
  Piemonte: "Torino|Vercelli|Novara|Cuneo|Asti|Alessandria|Biella|Verbano-Cusio-Ossola",
  "Valle d'Aosta": "Aosta|Valle d'Aosta/Vallée d'Aoste",
  Liguria: "Imperia|Savona|Genova|La Spezia",
  Lombardia: "Varese|Como|Sondrio|Milano|Bergamo|Brescia|Pavia|Cremona|Mantova|Lecco|Lodi|Monza e della Brianza",
  "Trentino-Alto Adige": "Bolzano|Bolzano-Bozen|Trento",
  Veneto: "Verona|Vicenza|Belluno|Treviso|Venezia|Padova|Rovigo",
  "Friuli Venezia Giulia": "Udine|Gorizia|Trieste|Pordenone|Friuli-Venezia Giulia",
  "Emilia-Romagna": "Piacenza|Parma|Reggio nell'Emilia|Reggio Emilia|Modena|Bologna|Ferrara|Ravenna|Forlì-Cesena|Rimini",
  Toscana: "Massa-Carrara|Lucca|Pistoia|Firenze|Livorno|Pisa|Arezzo|Siena|Grosseto|Prato",
  Umbria: "Perugia|Terni",
  Marche: "Pesaro e Urbino|Ancona|Macerata|Ascoli Piceno|Fermo",
  Lazio: "Viterbo|Rieti|Roma|Latina|Frosinone",
  Abruzzo: "L'Aquila|Teramo|Pescara|Chieti",
  Molise: "Campobasso|Isernia",
  Campania: "Caserta|Benevento|Napoli|Avellino|Salerno",
  Puglia: "Foggia|Bari|Taranto|Brindisi|Lecce|Barletta-Andria-Trani",
  Basilicata: "Potenza|Matera",
  Calabria: "Cosenza|Catanzaro|Reggio di Calabria|Reggio Calabria|Crotone|Vibo Valentia",
  Sicilia: "Trapani|Palermo|Messina|Agrigento|Caltanissetta|Enna|Catania|Ragusa|Siracusa",
  Sardegna: "Sassari|Nuoro|Cagliari|Oristano|Sud Sardegna|Gallura Nord-Est Sardegna|Ogliastra|Medio Campidano|Sulcis Iglesiente",
};
const key = (s: string) => s.toLocaleLowerCase("it-IT").normalize("NFD").replace(/[^a-z]/g, "");
const PLACE_TO_REGION = new Map<string, string>();
for (const [region, provinces] of Object.entries(PROVINCES)) {
  PLACE_TO_REGION.set(key(region), region);
  for (const p of provinces.split("|")) PLACE_TO_REGION.set(key(p), region);
}

/** Regioni da luoghi ANAC (nomi) o TED (codici NUTS); [] se il luogo non è riconosciuto. */
export function placesToRegions(places: string[]) {
  const regions = new Set<string>();
  for (const place of places) {
    if (key(place) === "italia") return ["ITALIA"];
    const region = NUTS2[place.slice(0, 4)] ?? PLACE_TO_REGION.get(key(place));
    if (region) regions.add(region);
  }
  return [...regions];
}

const euro = (value: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

const NATURA: Record<string, string> = { works: "Lavori", services: "Servizi", supplies: "Forniture" };

function tenderGrant(g: Pick<Grant, "id" | "title" | "ente" | "regions" | "deadline" | "url" | "source" | "raw"> & {
  natura: string | null; value: number | null; text: string;
}): Grant {
  return {
    id: g.id,
    title: g.title.slice(0, 500),
    ente: g.ente,
    level: "Gara d'appalto",
    status: "Aperto",
    regions: g.regions,
    sizes: ["*"],
    ateco_filter: ["*"],
    topics: inferTopics(g.text),
    invest_min_eur: null,
    invest_max_eur: null,
    opening_date: null,
    deadline: g.deadline,
    aid_type: ["Gara d'appalto", g.natura].filter(Boolean).join(" - "),
    budget: g.value ? `Valore stimato ${euro(g.value)}` : null,
    url: g.url,
    source: g.source,
    source_updated_at: null,
    requirements: g.text.slice(0, 6000),
    raw: g.raw,
    synced_at: new Date().toISOString(),
  };
}

type TedNotice = {
  "publication-number": string;
  "title-proc"?: Record<string, string>;
  "description-proc"?: Record<string, string>;
  "buyer-name"?: Record<string, string[]>;
  "contract-nature-main-proc"?: string;
  "deadline-receipt-tender-date-lot"?: string[];
  "place-of-performance-subdiv-lot"?: string[];
  "estimated-value-lot"?: string[];
  "classification-cpv"?: string[];
};

const TED_FIELDS = [
  "publication-number", "title-proc", "description-proc", "buyer-name", "contract-nature-main-proc",
  "deadline-receipt-tender-date-lot", "place-of-performance-subdiv-lot", "estimated-value-lot", "classification-cpv",
];

const ita = (value: Record<string, string> | undefined) => value?.ita ?? Object.values(value ?? {})[0] ?? "";

export function mapTedNotice(n: TedNotice, today: string): Grant | null {
  const deadline = (n["deadline-receipt-tender-date-lot"] ?? []).map((d) => d.slice(0, 10)).filter((d) => d >= today).sort()[0];
  if (!deadline) return null;
  const title = ita(n["title-proc"]);
  const description = ita(n["description-proc"]);
  const values = (n["estimated-value-lot"] ?? []).map(Number).filter((v) => v > 0);
  const regions = placesToRegions(n["place-of-performance-subdiv-lot"] ?? []);
  const pub = n["publication-number"];
  return tenderGrant({
    id: `TED-${pub}`,
    title: title || pub,
    ente: Object.values(n["buyer-name"] ?? {})[0]?.[0] ?? null,
    // senza luogo di esecuzione la gara è comunque italiana (buyer-country=ITA)
    regions: regions.length ? regions : ["ITALIA"],
    deadline,
    url: `https://ted.europa.eu/it/notice/-/detail/${pub}`,
    source: SYNC_SOURCES.ted,
    natura: NATURA[n["contract-nature-main-proc"] ?? ""] ?? null,
    value: values.length ? values.reduce((a, b) => a + b, 0) : null,
    text: [title, description].filter((t, i, all) => t && all.indexOf(t) === i).join("\n\n"),
    raw: { cpv: [...new Set(n["classification-cpv"] ?? [])] },
  });
}

export async function fetchTed(): Promise<Grant[]> {
  const today = new Date().toISOString().slice(0, 10);
  const query = `buyer-country=ITA AND notice-type IN (cn-standard cn-social) AND deadline-receipt-tender-date-lot>=${today.replace(/-/g, "")}`;
  const grants = new Map<string, Grant>();
  let token: string | null = null;
  // shortcut: massimo 40 pagine da 250 (10.000 avvisi); oggi le gare italiane aperte sono ~1.700.
  for (let page = 0; page < 40; page++) {
    const response = await fetch("https://api.ted.europa.eu/v3/notices/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({
        query, fields: TED_FIELDS, limit: 250, paginationMode: "ITERATION",
        ...(token ? { iterationNextToken: token } : {}),
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`TED HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const data = (await response.json()) as { notices: TedNotice[]; iterationNextToken?: string | null };
    for (const n of data.notices) {
      const grant = mapTedNotice(n, today);
      if (grant) grants.set(grant.id, grant);
    }
    token = data.iterationNextToken ?? null;
    if (!token || !data.notices.length) break;
  }
  return [...grants.values()];
}

type AnacItem = {
  cig?: string; descrizione?: string; natura_principale?: string; cpv?: string;
  valore_complessivo_stimato?: number; documenti_di_gara_link?: string; luogo_nuts?: string; luogo_istat?: string;
};
type AnacAvviso = {
  idAvviso: string;
  codiceScheda: string;
  tipologia: string;
  dataScadenza: string | null;
  templates: {
    template: {
      metadata: { link_eform_ted: string | null; titolo: string | null; descrizione: string | null };
      sections: { name: string; fields?: Record<string, unknown>; items?: AnacItem[] }[];
    };
  }[];
};

export function mapAnacAvviso(a: AnacAvviso, today: string): Grant | null {
  const deadline = a.dataScadenza?.slice(0, 10);
  const template = a.templates[0]?.template;
  // le gare con link TED sono già importate dalla fonte TED
  if (!template || !deadline || deadline < today || template.metadata.link_eform_ted) return null;
  const items = template.sections.flatMap((s) => s.items ?? []);
  const fields = Object.assign({}, ...template.sections.map((s) => s.fields ?? {})) as Record<string, unknown>;
  const committenti = (fields.soggetti_sa ?? []) as { denominazione_amministrazione?: string }[];
  const title = template.metadata.titolo || template.metadata.descrizione || items[0]?.descrizione || a.idAvviso;
  const value = items.reduce((sum, i) => sum + (i.valore_complessivo_stimato ?? 0), 0);
  const url = items.find((i) => i.documenti_di_gara_link)?.documenti_di_gara_link ?? (fields.documenti_di_gara_link as string | undefined);
  return tenderGrant({
    id: `ANAC-${a.idAvviso}`,
    title,
    ente: committenti.map((c) => c.denominazione_amministrazione).filter(Boolean).join(", ") || null,
    regions: placesToRegions(items.flatMap((i) => (i.luogo_nuts ? [i.luogo_nuts] : []))),
    deadline,
    url: url ?? null,
    source: SYNC_SOURCES.anac,
    natura: [...new Set(items.map((i) => i.natura_principale).filter(Boolean))].join(", ") || null,
    value: value || null,
    text: [title, ...new Set(items.flatMap((i) => [i.descrizione, i.cpv]).filter((t): t is string => Boolean(t) && t !== title))].join("\n\n"),
    raw: {
      tipologia: a.tipologia,
      cig: items.map((i) => i.cig).filter(Boolean),
      luogo: [...new Set(items.map((i) => i.luogo_istat).filter(Boolean))],
      procedura: fields.tipo_procedura_aggiudicazione ?? null,
    },
  });
}

const ANAC_API = "https://pubblicitalegale.anticorruzione.it/api/v0/avvisi";
// 4 = bandi, 5a/5b = indagini di mercato (avvisi con scadenza per presentare offerte o candidature)
const ANAC_SCHEDE = "4,5a,5b";
// shortcut: legge gli avvisi pubblicati negli ultimi 90 giorni; gare con scadenze più lontane (SDA, elenchi) sfuggono.
const ANAC_LOOKBACK_DAYS = 90;

export async function fetchAnac(): Promise<Grant[]> {
  const today = new Date().toISOString().slice(0, 10);
  const it = (d: Date) => d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" });
  const params = new URLSearchParams({
    dataPubblicazioneStart: it(new Date(Date.now() - ANAC_LOOKBACK_DAYS * 86_400_000)),
    dataPubblicazioneEnd: it(new Date()),
    codiceScheda: ANAC_SCHEDE,
    size: "1000",
  });
  const grants = new Map<string, Grant>();
  for (let page = 0, totalPages = 1; page < Math.min(totalPages, 50); page++) {
    params.set("page", String(page));
    const response = await fetch(`${ANAC_API}?${params}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`ANAC HTTP ${response.status}`);
    const data = (await response.json()) as { content: AnacAvviso[]; totalPages: number };
    totalPages = data.totalPages;
    for (const a of data.content) {
      const grant = mapAnacAvviso(a, today);
      if (grant) grants.set(grant.id, grant);
    }
  }
  return [...grants.values()];
}
