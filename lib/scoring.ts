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

const TEMI = [
  { key: "digitale", nome: "digitale", parole: ["digitale", "digital", "ai", "artificial intelligence"] },
  { key: "green", nome: "energia e sostenibilità", parole: ["green", "energia", "energy", "climate", "environment", "circular"] },
  { key: "ricerca_sviluppo", nome: "ricerca e innovazione", parole: ["r&s", "ricerca", "research", "innovation", "innovazione"] },
  { key: "cloud_cyber", nome: "cloud e cybersecurity", parole: ["cloud", "cyber", "cybersecurity"] },
  { key: "investimenti_beni", nome: "macchinari e beni strumentali", parole: ["investimenti", "investment", "beni", "strumentali"] },
  { key: "export", nome: "export", parole: ["export", "internaz", "international"] },
  { key: "formazione", nome: "formazione", parole: ["formazione", "training", "skills", "education"] },
] as const;

export function haTemi(customer: Customer) {
  return TEMI.some(({ key }) => customer[key]);
}

function norm(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function containsAny(haystack: string[], needles: readonly string[]) {
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
  const codici = codiciCliente(customer.ateco || customer.anagrafica?.ateco);
  const ammesso = atecoAmmesso(codici, grant.ateco_filter);
  const apertoATutti = !grant.ateco_filter.length || grant.ateco_filter.includes("*");
  // punteggio pieno solo se il bando è rivolto al settore del cliente, non a mezza economia
  const mirato = new Set(grant.ateco_filter.map((f) => f.slice(0, 2))).size <= MAX_DIVISIONI_MIRATO;
  const score_ateco = ammesso && mirato
    ? SCORE_WEIGHTS.ateco
    : ammesso || apertoATutti ? ATECO_GENERICO : 0;

  const temi = TEMI.filter(({ key, parole }) => customer[key] && containsAny(grant.topics, parole));
  const score_temi = Math.min(SCORE_WEIGHTS.temi, temi.length * 5);

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
    !score_tempistica && "bando chiuso",
    !score_regione && "altra regione",
    comune && comune !== norm(customer.anagrafica?.sede_comune) && "solo imprese del Comune",
    prov && camera.length > 0 && !camera.includes(prov.sigla) && "Camera di Commercio di altra provincia",
    !score_dimensione && "altri beneficiari",
    ammesso === false && "altri settori ATECO",
    ammesso === null && !apertoATutti && "riservato a settori, ATECO del cliente mancante",
    // call europee: in consorzio e di ricerca, servono la ricerca e un altro tema in comune
    grant.level === "UE" && !(customer.ricerca_sviluppo && temi.length > 1) && "call UE senza temi in comune",
    planned !== null && planned !== undefined && grant.invest_min_eur !== null && planned < grant.invest_min_eur
      && "investimento sotto il minimo",
  ].filter((motivo): motivo is string => Boolean(motivo));

  // Essere ammessi non basta: ci vuole qualcosa che leghi il bando proprio a questo cliente.
  const settori = codici.filter((c) => atecoAmmesso([c], grant.ateco_filter)).map((c) => c.slice(0, 2));
  const motivi = [
    ammesso && mirato && `settore ATECO ${[...new Set(settori)].join(", ")}`,
    ...temi.map(({ nome }) => nome),
    prov && camera.includes(prov.sigla) && "Camera di Commercio della sua provincia",
    comune && comune === norm(customer.anagrafica?.sede_comune) && "Comune della sede",
  ].filter((motivo): motivo is string => Boolean(motivo));

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
    motivi,
  };
}

export function minMatchScore() {
  return Number(process.env.MATCH_MIN_SCORE ?? 50);
}

/** Il cliente può partecipare e c'è almeno un motivo per proporglielo: il punteggio da solo serve a ordinare. */
export function isMatch(match: MatchResult, min: number) {
  return !match.esclusioni.length && match.motivi.length > 0 && match.score_totale >= min;
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
