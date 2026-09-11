import type { Grant } from "@/lib/types";

const BASE_URL =
  "https://api.tech.ec.europa.eu/search-api/prod/rest/search";

function one(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first === null || first === undefined ? null : String(first);
}

function many(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (Array.isArray(value)) return value.map(String);
  return value === null || value === undefined ? [] : [String(value)];
}

function isoDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function inferTopics(text: string) {
  const value = text.toLocaleLowerCase("en");
  const topics = new Set<string>(["investimenti"]);

  if (value.includes("digital") || value.includes("artificial intelligence")) topics.add("digitale");
  if (value.includes("cloud")) topics.add("cloud");
  if (value.includes("cyber")) topics.add("cybersecurity");
  if (
    value.includes("climate") ||
    value.includes("green") ||
    value.includes("energy") ||
    value.includes("circular") ||
    value.includes("environment")
  ) topics.add("green");
  if (value.includes("research") || value.includes("innovation")) topics.add("R&S");
  if (value.includes("international") || value.includes("export")) topics.add("export");
  if (value.includes("training") || value.includes("skills") || value.includes("education")) topics.add("formazione");

  return [...topics];
}

async function callPage(pageNumber: number) {
  const includeForthcoming =
    String(process.env.EU_INCLUDE_FORTHCOMING ?? "true").toLowerCase() !== "false";
  const programme = String(process.env.EU_PROGRAMME_FILTER ?? "").trim();

  const must: Array<Record<string, unknown>> = [
    { terms: { type: ["1"] } },
    {
      terms: {
        status: includeForthcoming
          ? ["31094501", "31094502"]
          : ["31094502"],
      },
    },
  ];

  if (programme) {
    must.push({ terms: { frameworkProgramme: [programme] } });
  }

  const form = new FormData();
  form.append(
    "query",
    new Blob([JSON.stringify({ bool: { must } })], {
      type: "application/json",
    })
  );
  form.append(
    "languages",
    new Blob([JSON.stringify(["en"])], { type: "application/json" })
  );
  form.append(
    "sort",
    new Blob([JSON.stringify({ field: "deadlineDate", order: "ASC" })], {
      type: "application/json",
    })
  );

  const pageSize = Math.max(1, Number(process.env.EU_PAGE_SIZE ?? 50));
  const url = new URL(BASE_URL);
  url.searchParams.set("apiKey", "SEDIA");
  url.searchParams.set("text", "***");
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("pageNumber", String(pageNumber));

  const response = await fetch(url, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Funding & Tenders HTTP ${response.status}`);
  }

  return response.json() as Promise<{
    totalResults?: number;
    results?: Array<{
      metadata?: Record<string, unknown>;
      summary?: string;
      url?: string;
    }>;
  }>;
}

function mapHit(hit: {
  metadata?: Record<string, unknown>;
  summary?: string;
  url?: string;
}): Grant {
  const m = hit.metadata ?? {};
  const identifier = one(m, "identifier") ?? crypto.randomUUID();
  const title = one(m, "title") ?? "EU Funding opportunity";
  const deadline = isoDate(one(m, "deadlineDate"));
  const opening = isoDate(one(m, "startDate"));
  const statusCode = one(m, "status");
  const today = new Date().toISOString().slice(0, 10);

  const status =
    statusCode === "31094501"
      ? "In arrivo"
      : deadline && deadline < today
        ? "Chiuso"
        : "Aperto";

  const actionTypes = many(m, "typesOfAction");
  const callTitle = one(m, "callTitle");
  const topicText = [
    title,
    callTitle,
    actionTypes.join(" "),
    hit.summary ?? "",
  ]
    .filter(Boolean)
    .join(" ; ");

  const canonicalUrl =
    `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier}`;

  const notes = [
    one(m, "callIdentifier") ? `Call: ${one(m, "callIdentifier")}` : null,
    one(m, "programmePeriod") ? `Periodo: ${one(m, "programmePeriod")}` : null,
    actionTypes.length ? `Tipi di azione: ${actionTypes.join(", ")}` : null,
    "Verificare eleggibilità, partenariato/consorzio e documentazione sul portale ufficiale.",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    id: `EU-${identifier}`,
    title,
    ente: "Commissione Europea",
    level: "UE",
    status,
    regions: ["ITALIA"],
    sizes: ["Micro", "Piccola", "Media", "Grande"],
    ateco_filter: ["*"],
    topics: inferTopics(topicText),
    invest_min_eur: null,
    invest_max_eur: null,
    opening_date: opening,
    deadline,
    aid_type: "Grant / call UE",
    budget: one(m, "budget"),
    url: canonicalUrl || hit.url || null,
    source: "EU Funding & Tenders",
    source_updated_at: null,
    requirements: notes,
    raw: hit,
    synced_at: new Date().toISOString(),
  };
}

export async function fetchEUFunding() {
  const pageSize = Math.max(1, Number(process.env.EU_PAGE_SIZE ?? 50));
  const maxPages = Math.max(1, Number(process.env.EU_MAX_PAGES ?? 20));

  const first = await callPage(1);
  const total = Number(first.totalResults ?? 0);
  const pages = Math.min(Math.ceil(total / pageSize) || 1, maxPages);
  const hits = [...(first.results ?? [])];

  for (let page = 2; page <= pages; page++) {
    const response = await callPage(page);
    hits.push(...(response.results ?? []));
  }

  return hits
    .map(mapHit)
    .filter((grant) => grant.status === "Aperto" || grant.status === "In arrivo");
}
