import type { CustomerInput } from "@/lib/types";
import {
  getIntegrationToken,
  saveIntegrationToken,
} from "@/lib/data";

const PROVIDER = "teamleader";
const AUTHORIZE_URL = "https://focus.teamleader.eu/oauth2/authorize";
const TOKEN_URL = "https://focus.teamleader.eu/oauth2/access_token";
const API_BASE = "https://api.focus.teamleader.eu";

// Rinnoviamo in anticipo per non rischiare di usare un token scaduto durante una sync lunga.
const REFRESH_SKEW_MS = 60_000;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} non configurato.`);
  return value;
}

export function getTeamleaderAuthorizationUrl(state: string) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", requireEnv("TEAMLEADER_CLIENT_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", requireEnv("TEAMLEADER_REDIRECT_URI"));
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

async function requestToken(body: Record<string, string>) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Teamleader OAuth HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }

  return (await response.json()) as TokenResponse;
}

export async function exchangeTeamleaderCode(code: string) {
  const token = await requestToken({
    client_id: requireEnv("TEAMLEADER_CLIENT_ID"),
    client_secret: requireEnv("TEAMLEADER_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: requireEnv("TEAMLEADER_REDIRECT_URI"),
  });

  await saveIntegrationToken(PROVIDER, {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  });
}

async function refreshTeamleaderToken(refreshToken: string) {
  // Teamleader ruota il refresh token ad ogni utilizzo: quello vecchio va scartato.
  const token = await requestToken({
    client_id: requireEnv("TEAMLEADER_CLIENT_ID"),
    client_secret: requireEnv("TEAMLEADER_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  await saveIntegrationToken(PROVIDER, {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  });

  return token.access_token;
}

export async function isTeamleaderConnected() {
  return Boolean(await getIntegrationToken(PROVIDER));
}

async function getValidAccessToken() {
  const stored = await getIntegrationToken(PROVIDER);
  if (!stored) {
    throw new Error("Teamleader non collegato. Vai in Impostazioni e connetti l'account.");
  }

  const expiresAt = new Date(stored.expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt - REFRESH_SKEW_MS > Date.now()) {
    return stored.access_token;
  }

  return refreshTeamleaderToken(stored.refresh_token);
}

async function teamleaderCall<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const accessToken = await getValidAccessToken();

  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After") ?? 2);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return teamleaderCall<T>(endpoint, body);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Teamleader API HTTP ${response.status} su ${endpoint}: ${detail.slice(0, 300)}`);
  }

  return (await response.json()) as T;
}

type TeamleaderAddress = {
  address?: {
    line_1?: string | null;
    postal_code?: string | null;
    city?: string | null;
    area_level_two?: string | null;
    country?: string | null;
  } | null;
};

type TeamleaderCustomFieldValue = string | number | boolean | { id?: string; label?: string; value?: unknown } | null;

type TeamleaderCompany = {
  id: string;
  name: string;
  vat_number?: string | null;
  business_type?: { name?: string } | null;
  primary_address?: TeamleaderAddress | null;
  addresses?: TeamleaderAddress[] | null;
  tags?: string[] | null;
  custom_fields?: Array<{ definition: { id: string }; value: TeamleaderCustomFieldValue }> | null;
};

type CompaniesListResponse = { data: TeamleaderCompany[] };

async function fetchCompaniesPage(page: number, pageSize: number) {
  const result = await teamleaderCall<CompaniesListResponse>("companies.list", {
    page: { size: pageSize, number: page },
    includes: "custom_fields",
  });
  return result.data ?? [];
}

// --- mapping company Teamleader -> CustomerInput -------------------------

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function customFieldRaw(company: TeamleaderCompany, envVarName: string) {
  const fieldId = process.env[envVarName];
  if (!fieldId) return null;

  const field = (company.custom_fields ?? []).find((f) => f.definition?.id === fieldId);
  if (!field || field.value === null || field.value === undefined) return null;

  const value = field.value;
  if (typeof value === "object") {
    return String(value.label ?? value.value ?? "").trim() || null;
  }
  return String(value).trim() || null;
}

function customFieldNumber(company: TeamleaderCompany, envVarName: string) {
  const raw = customFieldRaw(company, envVarName);
  if (!raw) return null;
  const cleaned = raw.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Sinonimi tag -> flag cliente. Si può ampliare senza toccare il resto del connettore.
const TAG_FLAG_SYNONYMS: Record<string, keyof Pick<
  CustomerInput,
  "digitale" | "green" | "ricerca_sviluppo" | "cloud_cyber" | "investimenti_beni" | "export" | "formazione"
>> = {
  digitale: "digitale",
  digital: "digitale",
  green: "green",
  sostenibilita: "green",
  ambiente: "green",
  "ricerca e sviluppo": "ricerca_sviluppo",
  "r&s": "ricerca_sviluppo",
  rs: "ricerca_sviluppo",
  innovazione: "ricerca_sviluppo",
  cloud: "cloud_cyber",
  cyber: "cloud_cyber",
  cybersecurity: "cloud_cyber",
  investimenti: "investimenti_beni",
  "beni strumentali": "investimenti_beni",
  export: "export",
  internazionalizzazione: "export",
  formazione: "formazione",
  training: "formazione",
};

function flagsFromTags(tags: string[] | null | undefined) {
  const flags = {
    digitale: false,
    green: false,
    ricerca_sviluppo: false,
    cloud_cyber: false,
    investimenti_beni: false,
    export: false,
    formazione: false,
  };

  for (const tag of tags ?? []) {
    const key = TAG_FLAG_SYNONYMS[normalize(tag)];
    if (key) flags[key] = true;
  }

  return flags;
}

function mapCompanyToCustomer(company: TeamleaderCompany): CustomerInput {
  const address = company.primary_address?.address ?? company.addresses?.[0]?.address ?? null;
  const flags = flagsFromTags(company.tags);

  const dipendentiRaw = customFieldNumber(company, "TEAMLEADER_CF_DIPENDENTI");

  return {
    external_id: `TEAMLEADER-${company.id}`,
    ragione_sociale: company.name || company.vat_number || `Azienda Teamleader ${company.id}`,
    regione: customFieldRaw(company, "TEAMLEADER_CF_REGIONE") ?? "",
    provincia: customFieldRaw(company, "TEAMLEADER_CF_PROVINCIA") ?? address?.area_level_two ?? null,
    ateco: customFieldRaw(company, "TEAMLEADER_CF_ATECO"),
    dimensione: customFieldRaw(company, "TEAMLEADER_CF_DIMENSIONE") ?? "Micro",
    dipendenti: dipendentiRaw !== null ? Math.round(dipendentiRaw) : null,
    fatturato_eur: customFieldNumber(company, "TEAMLEADER_CF_FATTURATO"),
    investimento_previsto_eur: customFieldNumber(company, "TEAMLEADER_CF_INVESTIMENTO"),
    digitale: flags.digitale,
    green: flags.green,
    ricerca_sviluppo: flags.ricerca_sviluppo,
    cloud_cyber: flags.cloud_cyber,
    investimenti_beni: flags.investimenti_beni,
    export: flags.export,
    formazione: flags.formazione,
    note: `Sincronizzato da Teamleader (companies/${company.id}).`,
  };
}

export async function fetchTeamleaderCustomers(): Promise<CustomerInput[]> {
  const pageSize = Math.max(1, Math.min(100, Number(process.env.TEAMLEADER_PAGE_SIZE ?? 100)));
  const maxPages = Math.max(1, Number(process.env.TEAMLEADER_MAX_PAGES ?? 100));

  const customers: CustomerInput[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const companies = await fetchCompaniesPage(page, pageSize);
    if (!companies.length) break;
    customers.push(...companies.map(mapCompanyToCustomer));
    if (companies.length < pageSize) break; // ultima pagina
  }

  return customers;
}
