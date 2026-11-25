import { atecoAmmesso, codiciCliente } from "@/lib/ateco";
import { provincia, provinceCamera } from "@/lib/province";
import type { Customer, Grant, MatchResult } from "@/lib/types";

export const SCORE_WEIGHTS = {
  regione: 25,
  dimensione: 15,
  ateco: 25,
  temi: 15,
  investimento: 10,
  tempistica: 10,
} as const;

/** Bando aperto a tutti i settori o a moltissimi: è ammesso, ma non è "del" settore del cliente. */
const ATECO_GENERICO = 12;
const MAX_DIVISIONI_MIRATO = 20;

function norm(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function containsAny(haystack: string[], needles: string[]) {
  const text = norm(haystack.join(" ; "));
  // a inizio parola; le sigle ("ai") solo intere, altrimenti "ai" è in "aiuti"
  return needles.some((needle) => {
    const n = norm(needle);
    return new RegExp(`(?<![a-z])${n}${n.length <= 2 ? "(?![a-z])" : ""}`).test(text);
  });
}

function sizeMatches(customerSize: string, allowed: string[]) {
  if (!allowed.length || allowed.includes("*")) return true;
  const c = norm(customerSize);
  return allowed.some((item) => {
    const a = norm(item);
    return a.includes(c) || c.includes(a);
  });
}

export function scoreGrant(customer: Customer, grant: Grant): MatchResult {
  const regionText = grant.regions.map(norm);
  // "Toscana, Lazio": il cliente ha sedi in più regioni
  const prov = provincia(customer.provincia);
  const customerRegions = norm(customer.regione || prov?.regione).split(",").map((r) => r.trim()).filter(Boolean);
  const score_regione =
    // senza regione il cliente rientra solo nei bandi nazionali
    regionText.some((r) => r === "italia" || customerRegions.some((c) => r.includes(c)))
      ? SCORE_WEIGHTS.regione
      : 0;

  const score_dimensione = sizeMatches(customer.dimensione, grant.sizes)
    ? SCORE_WEIGHTS.dimensione
    : 0;

  // l'ATECO letto dalla visura vale se quello della scheda manca
  const ammesso = atecoAmmesso(codiciCliente(customer.ateco || customer.anagrafica?.ateco), grant.ateco_filter);
  const apertoATutti = !grant.ateco_filter.length || grant.ateco_filter.includes("*");
  // punteggio pieno solo se il bando è rivolto al settore del cliente, non a mezza economia
  const mirato = new Set(grant.ateco_filter.map((f) => f.slice(0, 2))).size <= MAX_DIVISIONI_MIRATO;
  const score_ateco = ammesso && mirato
    ? SCORE_WEIGHTS.ateco
    : ammesso || apertoATutti ? ATECO_GENERICO : 0;

  let themePoints = 0;
  if (
    customer.digitale &&
    containsAny(grant.topics, ["digitale", "digital", "ai", "artificial intelligence"])
  ) themePoints += 5;
  if (
    customer.green &&
    containsAny(grant.topics, ["green", "energia", "energy", "climate", "environment", "circular"])
  ) themePoints += 5;
  if (
    customer.ricerca_sviluppo &&
    containsAny(grant.topics, ["r&s", "ricerca", "research", "innovation", "innovazione"])
  ) themePoints += 5;
  if (
    customer.cloud_cyber &&
    containsAny(grant.topics, ["cloud", "cyber", "cybersecurity"])
  ) themePoints += 5;
  if (
    customer.investimenti_beni &&
    containsAny(grant.topics, ["investimenti", "investment", "beni", "strumentali"])
  ) themePoints += 5;
  if (
    customer.export &&
    containsAny(grant.topics, ["export", "internaz", "international"])
  ) themePoints += 5;
  if (
    customer.formazione &&
    containsAny(grant.topics, ["formazione", "training", "skills", "education"])
  ) themePoints += 5;

  const score_temi = Math.min(SCORE_WEIGHTS.temi, themePoints);

  const planned = customer.investimento_previsto_eur;
  let score_investimento = 5;
  if (planned !== null && planned !== undefined) {
    const min = grant.invest_min_eur;
    const max = grant.invest_max_eur;

    if (min !== null || max !== null) {
      const aboveMin = min === null || planned >= min;
      const belowMax = max === null || planned <= max;
      score_investimento =
        aboveMin && belowMax ? SCORE_WEIGHTS.investimento : 0;
    }
  }

  const score_tempistica =
    grant.status === "Aperto" || grant.status === "In arrivo"
      ? SCORE_WEIGHTS.tempistica
      : 0;

  const score_totale =
    score_regione +
    score_dimensione +
    score_ateco +
    score_temi +
    score_investimento +
    score_tempistica;

  const comune = norm(grant.ente).match(/^comune di (.+)$/)?.[1];
  // l'ente; per Contributi Europa, che non lo indica, il titolo inizia con la Camera
  const camera = provinceCamera(grant.ente ?? grant.title.split(".")[0]);
  const esclusioni = [
    !score_regione && "altra regione",
    comune && comune !== norm(customer.anagrafica?.sede_comune) && "solo imprese del Comune",
    prov && camera.length > 0 && !camera.includes(prov.sigla) && "Camera di Commercio di altra provincia",
    !score_dimensione && "altri beneficiari",
    ammesso === false && "altri settori ATECO",
    ammesso === null && !apertoATutti && "riservato a settori, ATECO del cliente mancante",
    // call europee: in consorzio e su temi di ricerca, solo per chi ha dichiarato un tema in comune
    grant.level === "UE" && !score_temi && "call UE senza temi in comune",
  ].filter((motivo): motivo is string => Boolean(motivo));

  const classe =
    score_totale >= 75 ? "ALTA" : score_totale >= 50 ? "MEDIA" : "BASSA";

  return {
    grant,
    score_regione,
    score_dimensione,
    score_ateco,
    score_temi,
    score_investimento,
    score_tempistica,
    score_totale,
    esclusioni,
    classe,
  };
}

export function minMatchScore() {
  return Number(process.env.MATCH_MIN_SCORE ?? 50);
}

/** Sopra soglia e senza motivi di esclusione: il punteggio da solo non scarta un bando a cui il cliente non può partecipare. */
export function isMatch(match: MatchResult, min: number) {
  return !match.esclusioni.length && match.score_totale >= min;
}

export function scoreAll(customer: Customer, grants: Grant[]) {
  const minScore = minMatchScore();
  return grants
    .map((grant) => scoreGrant(customer, grant))
    .filter((match) => isMatch(match, minScore))
    .sort((a, b) => {
      if (b.score_totale !== a.score_totale) return b.score_totale - a.score_totale;
      const ad = a.grant.deadline ? new Date(a.grant.deadline).getTime() : Infinity;
      const bd = b.grant.deadline ? new Date(b.grant.deadline).getTime() : Infinity;
      return ad - bd;
    });
}
