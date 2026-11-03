import * as cheerio from "cheerio";
import type { Grant } from "@/lib/types";
import { CHAMBERS, fetchHtml, inferTopics, parseSlashDate, sleep } from "@/lib/sources/camcom";

// BandiCamereDiCommercio.it (dunp scpl, Roma): portale privato che raccoglie bandi di Camere,
// Regioni e Ministeri. Elenco ASP.NET WebForms: i filtri sono postback del form. La sitemap.txt
// non va usata: è ferma e non contiene i bandi più recenti.
const BASE_URL = "https://www.bandicameredicommercio.it";
const SOURCE = "BandiCamereDiCommercio.it";

// Camere che leggiamo già dai loro siti (lib/sources/camcom.ts): scartate per non avere doppioni.
// Pisa e Massa-Carrara sono confluite in Toscana Nord-Ovest.
const OWN_CHAMBERS = [...Object.values(CHAMBERS).map((c) => c.ente.replace(/^CCIAA\s+/, "")), "Pisa", "Massa Carrara"]
  .map((name) => name.toLocaleLowerCase("it-IT").replace(/[-\s]+/g, " "));

// Ente -> regione. Il primo nome che compare nell'ente vince: le voci composte vanno prima.
// shortcut: elenco degli enti presenti sul sito a novembre 2026; un ente nuovo resta senza regione finché non lo si aggiunge qui.
const REGION_BY_NAME: [string, string][] = [
  // "ITALIA" maiuscolo: è il valore che filtri e matching usano per i bandi nazionali
  ["mimit", "ITALIA"], ["invitalia", "ITALIA"], ["cassa forense", "ITALIA"],
  ["comune di roma", "Lazio"], ["unioncamere lombardia", "Lombardia"], ["unioncamere piemonte", "Piemonte"],
  ["reggio calabria", "Calabria"], ["reggio emilia", "Emilia-Romagna"], ["venezia giulia", "Friuli-Venezia Giulia"],
  ["catanzaro", "Calabria"], ["cosenza", "Calabria"], ["vibo valentia", "Calabria"],
  ["molise", "Molise"], ["umbria", "Umbria"], ["basilicata", "Basilicata"], ["marche", "Marche"],
  ["romagna", "Emilia-Romagna"], ["bologna", "Emilia-Romagna"], ["ferrara", "Emilia-Romagna"], ["modena", "Emilia-Romagna"],
  ["parma", "Emilia-Romagna"], ["piacenza", "Emilia-Romagna"], ["ravenna", "Emilia-Romagna"], ["rimini", "Emilia-Romagna"],
  ["alessandria", "Piemonte"], ["cuneo", "Piemonte"], ["torino", "Piemonte"], ["alto piemonte", "Piemonte"],
  ["avellino", "Campania"], ["benevento", "Campania"], ["napoli", "Campania"], ["salerno", "Campania"],
  ["bari", "Puglia"], ["brindisi", "Puglia"], ["foggia", "Puglia"], ["taranto", "Puglia"],
  ["bergamo", "Lombardia"], ["brescia", "Lombardia"], ["mantova", "Lombardia"], ["sondrio", "Lombardia"],
  ["cagliari", "Sardegna"], ["nuoro", "Sardegna"], ["chieti", "Abruzzo"], ["gran sasso", "Abruzzo"],
  ["firenze", "Toscana"], ["pisa", "Toscana"], ["massa carrara", "Toscana"], ["pistoia", "Toscana"],
  ["maremma", "Toscana"], ["toscana", "Toscana"],
  ["frosinone", "Lazio"], ["latina", "Lazio"], ["rieti", "Lazio"], ["roma", "Lazio"], ["lazio", "Lazio"],
  ["genova", "Liguria"], ["liguria", "Liguria"], ["messina", "Sicilia"], ["palermo", "Sicilia"], ["trapani", "Sicilia"],
  ["sicilia", "Sicilia"], ["padova", "Veneto"], ["treviso", "Veneto"], ["venezia", "Veneto"], ["verona", "Veneto"],
  ["vicenza", "Veneto"], ["pordenone", "Friuli-Venezia Giulia"], ["trento", "Trentino-Alto Adige"],
  ["valdostana", "Valle d'Aosta"], ["calabria", "Calabria"], ["lombardia", "Lombardia"], ["emilia", "Emilia-Romagna"],
];

const normName = (value: string) => value.toLocaleLowerCase("it-IT").replace(/[-\s]+/g, " ").trim();

export function regionForEnte(ente: string): string[] {
  const name = normName(ente);
  const hit = REGION_BY_NAME.find(([needle]) => name.includes(needle));
  return hit ? [hit[1]] : [];
}

export function isOwnChamber(ente: string) {
  const name = normName(ente);
  // parola intera: "roma" non deve scartare la CCIAA della Romagna
  return /cciaa|camera/.test(name) && OWN_CHAMBERS.some((own) => new RegExp(`(^|\\s)${own}(\\s|$)`).test(name));
}

function mapStatus(raw: string): Grant["status"] {
  const value = raw.toLocaleLowerCase("it-IT");
  if (value.includes("apertura")) return "In arrivo";
  if (value.includes("aperto")) return "Aperto";
  return "Chiuso";
}

function mapSizes(beneficiari: string[]) {
  const sizes = new Set<string>();
  for (const b of beneficiari.map((v) => v.toLocaleLowerCase("it-IT"))) {
    if (b === "pmi") ["Micro", "Piccola", "Media"].forEach((s) => sizes.add(s));
    else if (b.startsWith("micro") || b.startsWith("ditta")) sizes.add("Micro");
    else if (b.startsWith("grande")) sizes.add("Grande");
  }
  return sizes.size ? [...sizes] : ["*"];
}

/** "€ 4.000", "fino a 50.000€", "€1.500,50" -> 4000, 50000, 1500.5 */
function euros(raw: string | undefined): number | null {
  const match = raw?.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/);
  return match ? Number(match[0].replace(/\./g, "").replace(",", ".")) : null;
}

// Il testo della scheda alterna etichette fisse ("Ente: … Fondo / misura:"): prendo ciò che sta tra due etichette.
const between = (text: string, from: string, to: string) =>
  text.match(new RegExp(`${from}\\s*(.*?)\\s*${to}`, "i"))?.[1]?.trim() ?? "";
const list = (value: string) => value.split(",").map((s) => s.trim()).filter(Boolean);

const SOCIAL = /bandicameredicommercio|dunp\.it|linkedin|facebook|twitter|x\.com|whatsapp|wa\.me|telegram|t\.me|google\./i;

export function parseBando(html: string, url: string): Grant | null {
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer").remove();
  const main = $("main").first();
  const title = main.find("h1").first().text().replace(/\s+/g, " ").trim();
  const text = main.text().replace(/\s+/g, " ").trim();
  if (!title || !text.includes("Il bando in breve")) return null;

  const ente = between(text, "Ente:", "Fondo / misura:");
  const period = text.match(/Periodo di presentazione:\s*dal\s+(\S+)\s+al\s+(\S+)/i);
  const description = between(text, "Fondo / misura:", "Il bando in breve");
  const categorie = list(between(text, "Categorie", "Spese ammissibili"));
  const spese = list(between(text, "Spese ammissibili", "Settori"));
  const beneficiari = list(between(text, "Beneficiari", "Cosa puoi"));
  const official = main.find("a[href^='http']").map((_, el) => $(el).attr("href")).get().find((href) => !SOCIAL.test(href));
  const slug = new URL(url).pathname.split("/bando/")[1]?.replace(/\/$/, "");
  if (!slug) return null;

  return {
    id: `BCC-${slug}`.slice(0, 200),
    title,
    ente: ente || null,
    level: /cciaa|camera|unioncamere/i.test(ente) ? "Camerale" : /^regione/i.test(ente) ? "Regionale" : regionForEnte(ente)[0] === "ITALIA" ? "Nazionale" : null,
    status: mapStatus(between(text, "Stato:", "Tipologia:")),
    regions: regionForEnte(ente),
    sizes: mapSizes(beneficiari),
    ateco_filter: ["*"],
    topics: [...new Set(inferTopics([title, description, ...categorie, ...spese].join(" ; ")))],
    invest_min_eur: euros(between(text, "Importo del progetto minimo", "Contributo")),
    invest_max_eur: null,
    opening_date: parseSlashDate(period?.[1] ?? null),
    deadline: parseSlashDate(period?.[2] ?? null),
    aid_type: between(text, "Tipologia:", "Importo erogato:") || null,
    budget: between(text, "Importo erogato:", "Periodo di presentazione:") || null,
    // la pagina ufficiale dell'ente quando c'è: la scheda del portale è una sintesi commerciale
    url: official ?? url,
    source: SOURCE,
    source_updated_at: null,
    requirements: [
      description,
      categorie.length ? `Categorie: ${categorie.join(", ")}.` : "",
      spese.length ? `Spese ammissibili: ${spese.join(", ")}.` : "",
      beneficiari.length ? `Beneficiari: ${beneficiari.join(", ")}.` : "",
      `Scheda di sintesi: ${url}`,
    ].filter(Boolean).join(" | ").slice(0, 6000),
    raw: { url, ente, beneficiari, categorie, spese, official: official ?? null },
    synced_at: new Date().toISOString(),
  };
}

const LIST_URL = `${BASE_URL}/bandi-e-contributi`;
// valori della select "stato" del form: 1 = Aperto, 2 = In apertura (0 = Chiuso, 3 = qualsiasi)
const ACTIVE_STATES = ["1", "2"];

/** Link alle schede dei bandi attivi: replica il click su "Applica filtri" (postback "filtra") per ogni stato. */
async function listActiveUrls(): Promise<string[]> {
  const $form = cheerio.load(await fetchHtml(LIST_URL));
  if (!$form("select[name='stato']").length) throw new Error("Form filtri non trovato: la pagina elenco è cambiata.");

  const urls = new Set<string>();
  for (const stato of ACTIVE_STATES) {
    const body = new URLSearchParams();
    $form("form input[type='hidden']").each((_, el) => { body.set($form(el).attr("name") ?? "", $form(el).attr("value") ?? ""); });
    $form("form select").each((_, el) => { body.set($form(el).attr("name") ?? "", $form(el).find("option").first().attr("value") ?? ""); });
    body.set("stato", stato);
    body.set("__EVENTTARGET", "filtra");
    const res = await fetch(LIST_URL, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" }, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} (${LIST_URL}, stato ${stato})`);
    const $ = cheerio.load(await res.text());
    $("a[href*='/bando/']").each((_, el) => { urls.add(new URL($(el).attr("href") ?? "", BASE_URL).href); });
  }
  return [...urls];
}

export async function fetchBandiCamere(): Promise<Grant[]> {
  const delayMs = Math.max(0, Number(process.env.CAMCOM_LG_DELAY_MS ?? 400));
  const grants: Grant[] = [];
  for (const url of await listActiveUrls()) {
    try {
      const grant = parseBando(await fetchHtml(url), url);
      if (grant && !(grant.ente && isOwnChamber(grant.ente))) grants.push(grant);
    } catch {
      // una scheda irraggiungibile non deve bloccare le altre
    }
    await sleep(delayMs);
  }
  return grants;
}
