import { settoriBandIntelligence, soloNonImprese } from "@/lib/settori";
import type { Grant } from "@/lib/types";
import { inferTopics, sleep } from "@/lib/sources/camcom";

// BandIntelligence (bandintelligence.it/dati-aperti): API JSON pubblica e paginata.
// Condizioni: riuso libero citando «Fonte: BandIntelligence» con il link alla scheda;
// niente scaricamenti massivi ripetuti, quindi una sola lettura dell'elenco al giorno e niente dettagli.
const API_URL = "https://bandintelligence.it/api/search";
const SCHEDA_URL = "https://bandintelligence.it/bandi/";
const SOURCE = "BandIntelligence";
const PER_PAGE = 50; // massimo accettato dall'API
const MAX_PAGES = 40;
const USER_AGENT = "BandiMatch/1.0 (+matching bandi-clienti)";

// region_id 1-20 dell'API, in ordine alfabetico. Nomi scritti come nel resto del catalogo.
const REGIONS = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia",
  "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna",
  "Sicilia", "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

const FUNDING: Record<string, string> = {
  fondo_perduto: "Contributo a fondo perduto",
  misto: "Fondo perduto + finanziamento",
  finanziamento_agevolato: "Finanziamento agevolato",
  garanzia: "Garanzia",
  credito_imposta: "Credito d'imposta",
};

type BiBando = {
  slug: string;
  title: string;
  summary: string | null;
  sector: string | null;
  funding_type: string | null;
  status: "active" | "upcoming";
  max_amount: number | null;
  close_date: string | null;
  open_date: string | null;
  source_name: string | null;
  needs: string[] | null;
  regions: (string | number)[] | null;
  last_verified: string | null;
};

async function fetchPage(status: BiBando["status"], page: number) {
  const url = `${API_URL}?status=${status}&per_page=${PER_PAGE}&page=${page}&sort=deadline`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`BandIntelligence HTTP ${res.status} (${status}, pagina ${page})`);
  const body = (await res.json()) as { total?: number; results?: BiBando[] };
  if (!Array.isArray(body.results)) throw new Error("BandIntelligence: risposta senza elenco risultati");
  return { total: Number(body.total ?? 0), results: body.results };
}

function regionNames(ids: BiBando["regions"]) {
  const names = (ids ?? []).map((id) => REGIONS[Number(id) - 1]).filter(Boolean);
  return names.length ? [...new Set(names)] : ["ITALIA"];
}

export function mapBiBando(b: BiBando): Grant {
  const url = `${SCHEDA_URL}${b.slug}`;
  const regions = regionNames(b.regions);
  const funding = b.funding_type ? FUNDING[b.funding_type] ?? b.funding_type : null;
  const amount = b.max_amount ? ` fino a ${b.max_amount.toLocaleString("it-IT")} €` : "";
  const needs = b.needs ?? [];
  const summary = b.summary?.trim() ?? "";
  return {
    id: `BI-${b.slug}`,
    title: b.title,
    ente: b.source_name,
    level: /^european commission/i.test(b.source_name ?? "") ? "UE" : regions[0] === "ITALIA" ? "Nazionale" : "Regionale/locale",
    status: b.status === "upcoming" ? "In arrivo" : "Aperto",
    regions,
    sizes: soloNonImprese(`${b.title} ; ${summary}`) ? ["Enti pubblici o privati"] : ["*"],
    ateco_filter: settoriBandIntelligence(b.sector, b.title),
    topics: [...new Set([...needs, ...inferTopics([b.title, summary, needs.join(" ")].join(" ; "))])],
    invest_min_eur: null,
    invest_max_eur: null,
    opening_date: b.open_date,
    deadline: b.close_date,
    aid_type: funding ? `${funding}${amount}` : null,
    budget: null,
    url,
    source: SOURCE,
    source_updated_at: b.last_verified,
    requirements:
      `${summary || "Verificare i requisiti sul testo ufficiale del bando."}\n\n` +
      `Fonte: BandIntelligence (${url}). Controllare il testo ufficiale prima di presentare domanda.`,
    raw: b,
    synced_at: new Date().toISOString(),
  };
}

export async function fetchBandIntelligence(): Promise<Grant[]> {
  const delayMs = Math.max(0, Number(process.env.CAMCOM_LG_DELAY_MS ?? 400));
  const items = new Map<string, BiBando>();

  for (const status of ["active", "upcoming"] as const) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { total, results } = await fetchPage(status, page);
      for (const b of results) items.set(b.slug, b);
      if (results.length < PER_PAGE || page * PER_PAGE >= total) break;
      await sleep(delayMs);
    }
  }

  // incentivi.gov.it lo sincronizziamo già direttamente: qui teniamo solo le altre fonti, per non duplicare.
  return [...items.values()].filter((b) => b.source_name !== "incentivi.gov.it").map(mapBiBando);
}
