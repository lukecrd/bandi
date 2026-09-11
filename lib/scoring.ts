import type { Customer, Grant, MatchResult } from "@/lib/types";

export const SCORE_WEIGHTS = {
  regione: 25,
  dimensione: 15,
  ateco: 15,
  temi: 25,
  investimento: 10,
  tempistica: 10,
} as const;

function norm(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function containsAny(haystack: string[], needles: string[]) {
  const text = norm(haystack.join(" ; "));
  return needles.some((needle) => text.includes(norm(needle)));
}

function sizeMatches(customerSize: string, allowed: string[]) {
  if (!allowed.length || allowed.includes("*")) return true;
  const c = norm(customerSize);
  return allowed.some((item) => {
    const a = norm(item);
    return a.includes(c) || c.includes(a);
  });
}

function atecoMatches(ateco: string | null, filters: string[]) {
  if (!filters.length || filters.includes("*")) return true;
  if (!ateco) return false;
  const compact = ateco.replace(/\s/g, "");
  const prefix2 = compact.slice(0, 2);
  return filters.some((filter) => {
    const f = String(filter).replace(/\s/g, "");
    return f === compact || f === prefix2 || compact.startsWith(f);
  });
}

export function scoreGrant(customer: Customer, grant: Grant): MatchResult {
  const regionText = grant.regions.map(norm);
  const customerRegion = norm(customer.regione);
  const score_regione =
    regionText.some((r) => r === "italia" || r.includes(customerRegion))
      ? SCORE_WEIGHTS.regione
      : 0;

  const score_dimensione = sizeMatches(customer.dimensione, grant.sizes)
    ? SCORE_WEIGHTS.dimensione
    : 0;

  const score_ateco = atecoMatches(customer.ateco, grant.ateco_filter)
    ? SCORE_WEIGHTS.ateco
    : 0;

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
    classe,
  };
}

export function scoreAll(customer: Customer, grants: Grant[]) {
  const minScore = Number(process.env.MATCH_MIN_SCORE ?? 50);
  return grants
    .map((grant) => scoreGrant(customer, grant))
    .filter((match) => match.score_totale >= minScore)
    .sort((a, b) => {
      if (b.score_totale !== a.score_totale) return b.score_totale - a.score_totale;
      const ad = a.grant.deadline ? new Date(a.grant.deadline).getTime() : Infinity;
      const bd = b.grant.deadline ? new Date(b.grant.deadline).getTime() : Infinity;
      return ad - bd;
    });
}
