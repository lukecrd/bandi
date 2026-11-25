import { get } from "node:https";
import { codiciBando } from "@/lib/ateco";
import { settoriIncentivi } from "@/lib/settori";
import type { Grant } from "@/lib/types";

// Il sito blocca le connessioni da fuori Europa (ETIMEDOUT dagli USA): per questo in vercel.json
// le route che lo sincronizzano girano in fra1.
// Da novembre 2026 incentivi.gov.it rimanda (302) a incentivitalia.gov.it e la vecchia API Solr non esiste più:
// si legge l'open data ufficiale, un unico JSON (~30 MB, ~6000 bandi).
const OPEN_DATA_URL = "https://www.incentivitalia.gov.it/open-data/incentivi/OpenData_Incentivi.json";

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
  const value = first(doc[field]);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
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

export function mapDoc(doc: Record<string, unknown>): Grant {
  const rawId = text(doc, "idBando") ?? crypto.randomUUID();

  const grantor = text(doc, "Soggetto_Concedente", "Amministrazione_responsabile");
  const opening = dateValue(doc, "Data_apertura");
  const deadline = dateValue(doc, "Data_chiusura");
  const minRaw = numberValue(doc, "Spesa_Ammessa_Min");
  const maxRaw = numberValue(doc, "Spesa_Ammessa_Max");
  const min = minRaw !== null && maxRaw !== null && minRaw > maxRaw ? maxRaw : minRaw;
  const max = minRaw !== null && maxRaw !== null && minRaw > maxRaw ? minRaw : maxRaw;

  // "Regione Siciliana - Dipartimento…" non è nazionale, e un ministero può finanziare una sola regione
  const elenco = fieldList(doc, "Regioni");
  const locale = /^(?:regione|provincia|comune|camera|unione|cciaa)/i.test(grantor ?? "");
  const national = !locale && (elenco.length >= 15 || (!elenco.length && isNational(grantor)));
  const regions = national ? ["ITALIA"] : elenco;

  // Enti, cittadini, università: la dimensione è spesso compilata lo stesso, ma non è un bando per imprese.
  const soggetti = Array.isArray(doc.Tipologia_Soggetto) ? doc.Tipologia_Soggetto.map(String) : [];
  const perImprese = !soggetti.length || soggetti.some((s) => /^Impresa$|^Impresa - |^Professionista$/.test(s));
  const dimensioni = fieldList(doc, "Dimensione_beneficiari").filter((d) => !/^non classificabile/i.test(d));
  const sizes = perImprese ? dimensioni : soggetti;
  // i nomi di settore contengono virgole: niente fieldList, che li spezza
  const settori = Array.isArray(doc.Settore_Attivita) ? doc.Settore_Attivita.map(String) : [];
  const codici = codiciBando(text(doc, "Codici_ATECO"));
  // i settori stanno in ateco_filter: come temi, "Fornitura Energia…" farebbe scattare il tema energia su tutto
  const topics = fieldList(doc, "Obiettivo_Finalita");

  return {
    id: `IGOV-${rawId}`,
    title: text(doc, "Titolo") ?? "Incentivo senza titolo",
    ente: grantor,
    level: national ? "Nazionale" : "Regionale/locale",
    status: inferStatus(opening, deadline),
    regions: regions.length ? regions : ["ITALIA"],
    sizes: sizes.length ? sizes : ["*"],
    ateco_filter: codici.includes("*") ? settoriIncentivi(settori) : codici,
    topics,
    invest_min_eur: min,
    invest_max_eur: max,
    opening_date: opening,
    deadline,
    aid_type: fieldList(doc, "Forma_agevolazione").join(", ") || null,
    budget: text(doc, "Stanziamento_incentivo"),
    url: text(doc, "Link_istituzionale"),
    source: "Incentivi.gov.it",
    source_updated_at: null,
    requirements:
      text(doc, "Descrizione")?.slice(0, 6000) ??
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

export async function fetchIncentiviGov() {
  // il server a volte tronca la risposta ("fetch failed"): riprova
  let docs: unknown;
  for (let attempt = 1; ; attempt++) {
    try {
      docs = JSON.parse((await getText(new URL(OPEN_DATA_URL))).replace(/^﻿/, ""));
      break;
    } catch (error) {
      if (attempt >= 3) {
        throw new Error(`Incentivi.gov.it, open data: ${error instanceof Error ? error.message : error}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  if (!Array.isArray(docs)) throw new Error("Incentivi.gov.it, open data: formato inatteso");

  const grants = (docs as Record<string, unknown>[]).map(mapDoc);
  return grants.filter((g) => g.status === "Aperto" || g.status === "In arrivo");
}
