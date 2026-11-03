import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveGrants, getCustomer, getCustomers } from "@/lib/data";
import { scoreAll } from "@/lib/scoring";
import type { Customer, Grant } from "@/lib/types";

// gli id dei modelli Gemini cambiano spesso: sovrascrivibile da env
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
// usato se il modello principale è sovraccarico (503) o ha finito la quota gratuita (429), che è per modello
const FALLBACK_MODEL = "gemini-3.5-flash-lite";
const MAX_ITERATIONS = 5;

// Colonne di bando passate al modello: niente `raw`, requisiti troncati per contenere i token.
// Date come testo: il driver le converte in Date UTC e il giorno slitterebbe.
const GRANT_COLUMNS = `id, title, ente, status, regions, sizes, ateco_filter, topics,
  invest_min_eur, invest_max_eur, opening_date::text AS opening_date, deadline::text AS deadline,
  aid_type, budget, url, source,
  LEFT(requirements, 400) AS requirements`;

const searchBandiInput = z.object({
  testo: z.string().max(200).optional(),
  stato: z.enum(["attivi", "Aperto", "In arrivo", "Chiuso", "tutti"]).optional(),
  regione: z.string().max(60).optional(),
  ateco: z.string().max(20).optional(),
  scadenza_da: z.string().date().optional(),
  scadenza_a: z.string().date().optional(),
  limite: z.number().int().min(1).max(50).optional(),
});

const cercaClientiInput = z.object({ testo: z.string().max(200) });

const matchClienteInput = z.object({
  cliente_id: z.string().uuid(),
  limite: z.number().int().min(1).max(30).optional(),
});

const TOOLS = [
  {
    name: "search_bandi",
    description:
      "Cerca bandi (finanza agevolata) nel database. Tutti i filtri sono opzionali e combinati in AND. Restituisce al massimo `limite` bandi ordinati per scadenza, con titolo, ente, stato, regioni, dimensioni ammesse, codici ATECO ammessi, temi, importi, date e url.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        testo: { type: "string", description: "Parole cercate in titolo, ente, temi e requisiti (es. 'manifattura', 'digitale')." },
        stato: { type: "string", enum: ["attivi", "Aperto", "In arrivo", "Chiuso", "tutti"], description: "Default 'attivi' = Aperto o In arrivo." },
        regione: { type: "string", description: "Nome regione (es. 'Toscana'). Include sempre anche i bandi nazionali." },
        ateco: { type: "string", description: "Codice o prefisso ATECO (es. '25' o '25.62'). Include i bandi senza filtro ATECO." },
        scadenza_da: { type: "string", description: "Data minima di scadenza, formato YYYY-MM-DD." },
        scadenza_a: { type: "string", description: "Data massima di scadenza, formato YYYY-MM-DD." },
        limite: { type: "integer", description: "Numero massimo di risultati, 1-50 (default 20)." },
      },
    },
  },
  {
    name: "cerca_clienti",
    description:
      "Cerca clienti per ragione sociale, codice cliente, regione o ATECO. Restituisce id e profilo (regione, provincia, ATECO, dimensione, dipendenti, fatturato, investimento previsto, interessi tematici, note).",
    parametersJsonSchema: {
      type: "object",
      properties: { testo: { type: "string", description: "Testo da cercare, es. una parte della ragione sociale." } },
      required: ["testo"],
    },
  },
  {
    name: "match_cliente",
    description:
      "Restituisce i bandi attivi più adatti a un cliente, calcolati con il punteggio di matching dell'app (0-100: regione 25, dimensione 15, ATECO 15, temi 25, investimento 10, tempistica 10; classe ALTA >= 75, MEDIA >= 50). Serve l'id ottenuto da cerca_clienti.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string", description: "id (UUID) del cliente." },
        limite: { type: "integer", description: "Numero massimo di bandi, 1-30 (default 10)." },
      },
      required: ["cliente_id"],
    },
  },
];

const ROME_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" });
const romeDay = (value: string | null) => (value ? ROME_DAY.format(new Date(value)) : null);

function compactGrant(g: Grant) {
  return {
    id: g.id, title: g.title, ente: g.ente, status: g.status, regions: g.regions, sizes: g.sizes,
    ateco_filter: g.ateco_filter, topics: g.topics, invest_min_eur: g.invest_min_eur,
    invest_max_eur: g.invest_max_eur, opening_date: romeDay(g.opening_date), deadline: romeDay(g.deadline),
    aid_type: g.aid_type, budget: g.budget, url: g.url, source: g.source,
  };
}

// L'anagrafica (codici fiscali, IBAN, documenti) non viene mai inviata al modello.
function customerProfile(c: Customer) {
  return {
    id: c.id, codice: c.external_id, ragione_sociale: c.ragione_sociale, regione: c.regione,
    provincia: c.provincia, ateco: c.ateco, dimensione: c.dimensione, dipendenti: c.dipendenti,
    fatturato_eur: c.fatturato_eur, investimento_previsto_eur: c.investimento_previsto_eur,
    interessi: (["digitale", "green", "ricerca_sviluppo", "cloud_cyber", "investimenti_beni", "export", "formazione"] as const)
      .filter((k) => c[k]),
    note: c.note,
  };
}

async function searchBandi(raw: unknown) {
  const i = searchBandiInput.parse(raw);
  const stato = i.stato ?? "attivi";
  const rows = await db().query(
    `SELECT ${GRANT_COLUMNS}
     FROM grants
     WHERE ($1 = '' OR title ILIKE '%' || $1 || '%' OR COALESCE(ente,'') ILIKE '%' || $1 || '%'
            OR COALESCE(requirements,'') ILIKE '%' || $1 || '%' OR array_to_string(topics, ' ') ILIKE '%' || $1 || '%')
       AND ($2 = 'tutti' OR ($2 = 'attivi' AND status IN ('Aperto', 'In arrivo')) OR status = $2)
       AND ($3 = '' OR EXISTS (SELECT 1 FROM unnest(regions) r WHERE r ILIKE $3 OR r = 'ITALIA'))
       AND ($4 = '' OR cardinality(ateco_filter) = 0 OR '*' = ANY(ateco_filter)
            OR EXISTS (SELECT 1 FROM unnest(ateco_filter) f WHERE $4 LIKE f || '%' OR f LIKE $4 || '%'))
       AND ($5::date IS NULL OR deadline >= $5::date)
       AND ($6::date IS NULL OR deadline <= $6::date)
     ORDER BY deadline NULLS LAST, title
     LIMIT $7`,
    [
      i.testo?.trim() ?? "", stato, i.regione?.trim() ?? "", i.ateco?.replace(/\s/g, "") ?? "",
      i.scadenza_da ?? null, i.scadenza_a ?? null, i.limite ?? 20,
    ]
  );
  return { totale: rows.length, bandi: rows };
}

async function cercaClienti(raw: unknown) {
  const { testo } = cercaClientiInput.parse(raw);
  const customers = await getCustomers(testo.trim());
  return { totale: customers.length, clienti: customers.slice(0, 20).map(customerProfile) };
}

async function matchCliente(raw: unknown) {
  const { cliente_id, limite } = matchClienteInput.parse(raw);
  const customer = await getCustomer(cliente_id);
  if (!customer) return { errore: "Cliente non trovato." };
  const matches = scoreAll(customer, await getActiveGrants(10000));
  return {
    cliente: customerProfile(customer),
    totale_match: matches.length,
    bandi: matches.slice(0, limite ?? 10).map(({ grant, ...score }) => ({ ...score, bando: compactGrant(grant) })),
  };
}

const HANDLERS: Record<string, (input: unknown) => Promise<unknown>> = {
  search_bandi: searchBandi,
  cerca_clienti: cercaClienti,
  match_cliente: matchCliente,
};

function systemPrompt() {
  const oggi = ROME_DAY.format(new Date());
  return `Sei l'assistente interno di una società di consulenza che segue bandi pubblici e finanza agevolata per i propri clienti.
Rispondi sempre in italiano, in modo conciso. Oggi è ${oggi}.
Usa gli strumenti per leggere i bandi e i clienti dal database: non inventare bandi, scadenze o dati dei clienti. Se gli strumenti non restituiscono nulla, dillo.
Per "bandi adatti a un cliente" usa cerca_clienti per trovare l'id e poi match_cliente. Settori espressi a parole vanno tradotti in prefissi ATECO (es. manifatturiero = sezione C, divisioni 10-33) o in parole chiave di ricerca.
Quando citi un bando indica titolo, scadenza e, se presente, l'url completo su una riga a parte. Scrivi testo semplice: niente tabelle né markdown, al massimo elenchi con "- ".`;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export class AssistenteError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

type GeminiPart = { text?: string; functionCall?: { id?: string; name: string; args?: unknown } };
type GeminiContent = { role: "user" | "model"; parts: (GeminiPart | Record<string, unknown>)[] };
type GeminiResponse = {
  candidates?: { content?: GeminiContent; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);

async function callGemini(apiKey: string, contents: GeminiContent[], model = MODEL): Promise<GeminiResponse> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt() }] },
      tools: [{ functionDeclarations: TOOLS }],
      contents,
    }),
  });
  if (res.ok) return res.json();
  const body = await res.text();
  if ((res.status === 503 || res.status === 429) && model !== FALLBACK_MODEL) return callGemini(apiKey, contents, FALLBACK_MODEL);
  console.error("Gemini API error", res.status, body);
  if (res.status === 401 || res.status === 403 || body.includes("API_KEY_INVALID")) {
    throw new AssistenteError("Chiave GEMINI_API_KEY non valida.", 502);
  }
  if (res.status === 429) {
    throw new AssistenteError("Limite di richieste del servizio AI raggiunto: riprova tra qualche istante.", 429);
  }
  throw new AssistenteError(`Errore del servizio AI (${res.status}): riprova più tardi.`, 502);
}

export async function runAssistente(history: ChatMessage[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AssistenteError("Assistente non configurato: manca la variabile GEMINI_API_KEY.", 503);
  }
  const contents: GeminiContent[] = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await callGemini(apiKey, contents);
    const candidate = response.candidates?.[0];
    if (response.promptFeedback?.blockReason || BLOCKED.has(candidate?.finishReason ?? "") || !candidate?.content) {
      return "Non posso rispondere a questa richiesta.";
    }

    const parts = candidate.content.parts as GeminiPart[];
    const calls = parts.flatMap((p) => (p.functionCall ? [p.functionCall] : []));
    if (calls.length === 0) {
      return parts.flatMap((p) => (p.text ? [p.text] : [])).join("").trim() || "Nessuna risposta dal modello.";
    }

    // contenuto rimandato intatto: i modelli Gemini 3 richiedono le thought signature
    contents.push(candidate.content);
    const results = [];
    for (const call of calls) {
      const handler = HANDLERS[call.name];
      let response: Record<string, unknown>;
      try {
        if (!handler) throw new Error(`Strumento sconosciuto: ${call.name}`);
        response = { output: await handler(call.args ?? {}) };
      } catch (error) {
        response = { error: error instanceof z.ZodError ? `Parametri non validi: ${error.message}` : error instanceof Error ? error.message : "Errore" };
      }
      results.push({ functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response } });
    }
    contents.push({ role: "user", parts: results });
  }
  return "La domanda richiede troppe ricerche: prova a riformularla in modo più specifico.";
}
