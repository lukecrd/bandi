import { get } from "node:https";
import type { Grant } from "@/lib/types";

const BASE_URL = "https://www.incentivi.gov.it/solr/coredrupal/select";
// Solo i campi usati da mapDoc: con fl=* ogni pagina pesa ~3 MB e il server chiude spesso la connessione a metà.
const FIELDS = [
  "id", "ss_id", "ss_search_api_id", "ss_title", "tum_X3b_it_title_ft", "title", "zs_body",
  "zs_field_subject_grant", "ss_field_subject_grant", "zs_field_open_date", "zs_field_close_date",
  "zs_field_cost_min", "zs_field_cost_max", "zs_field_regions_value", "zs_field_dimensions_value",
  "zs_field_scopes_value", "zs_field_activity_sector_value", "zs_field_support_form_value",
  "zs_field_budget", "zs_field_resources", "zs_field_link",
].join(",");

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function text(doc: Record<string, unknown>, ...fields: string[]) {
  for (const field of fields) {
    const value = first(doc[field]);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function numberValue(doc: Record<string, unknown>, field: string) {
  const raw = text(doc, field);
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function dateValue(doc: Record<string, unknown>, field: string) {
  const raw = text(doc, field);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function list(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(/[;,|]/))
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (value === null || value === undefined) return [];
  return String(value)
    .split(/[;,|]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function fieldList(doc: Record<string, unknown>, field: string) {
  return list(doc[field]);
}

function inferStatus(opening: string | null, deadline: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  if (deadline && deadline < today) return "Chiuso";
  if (opening && opening > today) return "In arrivo";
  return "Aperto";
}

function isNational(grantor: string | null) {
  const value = (grantor ?? "").toLocaleLowerCase("it-IT");
  return [
    "minister",
    "mimit",
    "invitalia",
    "agenzia nazionale",
    "presidenza del consiglio",
    "dipartimento",
  ].some((marker) => value.includes(marker));
}

function mapDoc(doc: Record<string, unknown>): Grant {
  const searchId = text(doc, "ss_search_api_id");
  const rawId =
    searchId?.includes("node/")
      ? searchId.split("node/").pop()!
      : text(doc, "id", "ss_id") ?? crypto.randomUUID();

  const grantor = text(doc, "zs_field_subject_grant", "ss_field_subject_grant");
  const opening = dateValue(doc, "zs_field_open_date");
  const deadline = dateValue(doc, "zs_field_close_date");
  const minRaw = numberValue(doc, "zs_field_cost_min");
  const maxRaw = numberValue(doc, "zs_field_cost_max");
  const min = minRaw !== null && maxRaw !== null && minRaw > maxRaw ? maxRaw : minRaw;
  const max = minRaw !== null && maxRaw !== null && minRaw > maxRaw ? minRaw : maxRaw;

  const regions = isNational(grantor)
    ? ["ITALIA"]
    : fieldList(doc, "zs_field_regions_value");

  const sizes = fieldList(doc, "zs_field_dimensions_value");
  const topics = [
    ...fieldList(doc, "zs_field_scopes_value"),
    ...fieldList(doc, "zs_field_activity_sector_value"),
    ...sizes,
  ];

  return {
    id: `IGOV-${rawId}`,
    title:
      text(doc, "tum_X3b_it_title_ft", "ss_title", "title") ??
      "Incentivo senza titolo",
    ente: grantor,
    level: isNational(grantor) ? "Nazionale" : "Regionale/locale",
    status: inferStatus(opening, deadline),
    regions: regions.length ? regions : ["ITALIA"],
    sizes: sizes.length ? sizes : ["*"],
    ateco_filter: ["*"],
    topics,
    invest_min_eur: min,
    invest_max_eur: max,
    opening_date: opening,
    deadline,
    aid_type: text(doc, "zs_field_support_form_value"),
    budget: text(doc, "zs_field_budget", "zs_field_resources"),
    url: text(doc, "zs_field_link"),
    source: "Incentivi.gov.it",
    source_updated_at: null,
    requirements:
      text(doc, "zs_body")?.slice(0, 6000) ??
      "Verificare i requisiti completi sulla fonte ufficiale.",
    raw: doc,
    synced_at: new Date().toISOString(),
  };
}

// node:https invece di fetch: quando il server chiude la connessione a metà risposta,
// undici (fetch) può andare in crash con un assert interno invece di dare un errore gestibile.
function getText(url: URL) {
  return new Promise<string>((resolve, reject) => {
    const request = get(url, { headers: { Accept: "application/json" }, timeout: 60_000 }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`Incentivi.gov.it HTTP ${response.statusCode}`));
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => (response.complete ? resolve(body) : reject(new Error("risposta troncata"))));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}

async function fetchPage(start: number, rows: number) {
  const url = new URL(BASE_URL);
  url.searchParams.set("q", "*:*");
  url.searchParams.set("q.op", "OR");
  url.searchParams.set("fq", "index_id:incentivi");
  url.searchParams.set("fl", FIELDS);
  url.searchParams.set("rows", String(rows));
  url.searchParams.set("start", String(start));
  url.searchParams.set("wt", "json");

  // il server a volte tronca la risposta ("fetch failed"): riprova la stessa pagina
  let json;
  for (let attempt = 1; ; attempt++) {
    try {
      json = JSON.parse(await getText(url));
      break;
    } catch (error) {
      if (attempt >= 3) {
        throw new Error(`Incentivi.gov.it, pagina da ${start}: ${error instanceof Error ? error.message : error}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  return {
    docs: (json?.response?.docs ?? []) as Record<string, unknown>[],
    total: Number(json?.response?.numFound ?? 0),
  };
}

export async function fetchIncentiviGov() {
  const pageRows = Math.max(1, Number(process.env.INCENTIVI_PAGE_ROWS ?? 200));
  const maxPages = Math.max(1, Number(process.env.INCENTIVI_MAX_PAGES ?? 35));

  const firstPage = await fetchPage(0, pageRows);
  const pages = Math.min(Math.ceil(firstPage.total / pageRows) || 1, maxPages);
  const allDocs = [...firstPage.docs];

  for (let page = 1; page < pages; page++) {
    const result = await fetchPage(page * pageRows, pageRows);
    allDocs.push(...result.docs);
  }

  const grants = allDocs.map(mapDoc);
  return grants.filter((g) => g.status === "Aperto" || g.status === "In arrivo");
}
