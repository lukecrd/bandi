import * as cheerio from "cheerio";
import type { Grant } from "@/lib/types";
import { fetchHtml, inferTopics, parseItalianLongDate, sleep } from "@/lib/sources/camcom";

// Sviluppo Toscana (WordPress + FacetWP). L'API REST di WordPress espone i bandi
// ma senza stato né date: leggiamo l'elenco filtrato per stato e poi il dettaglio.
const BASE_URL = "https://www.sviluppo.toscana.it";
const SOURCE = "Sviluppo Toscana";
const LIST_URL = `${BASE_URL}/bandi/?_stato=aperto,in-scadenza,in-arrivo`;

type ListedBando = { title: string; url: string; slug: string; statusRaw: string; summary: string };

function extractListing(html: string) {
  const $ = cheerio.load(html);
  const items: ListedBando[] = [];
  $("article.rtds-card").each((_, el) => {
    const link = $(el).find(".rtds-card__title a").first();
    const url = link.attr("href");
    const slug = url?.split("/bando/")[1]?.replace(/\/$/, "");
    if (!url || !slug) return;
    items.push({
      title: link.text().trim(),
      url,
      slug,
      statusRaw: $(el).find(".rtds-chip--status").text().replace(/Stato:/i, "").trim(),
      summary: $(el).find(".rtds-card__description").text().replace(/\s+/g, " ").trim(),
    });
  });

  const fwp = html.match(/FWP_JSON\s*=\s*(\{[\s\S]*?\});/)?.[1];
  const totalPages = fwp ? Number(JSON.parse(fwp)?.preload_data?.settings?.pager?.total_pages) || 1 : 1;
  return { items, totalPages };
}

function mapStatus(raw: string): Grant["status"] {
  return /in arrivo/i.test(raw) ? "In arrivo" : "Aperto"; // "Aperto" e "In Scadenza"
}

function mapSizes(destinatari: string[]) {
  const sizes = new Set<string>();
  for (const d of destinatari) {
    const v = d.toLocaleLowerCase("it-IT");
    if (v === "pmi") ["Micro", "Piccola", "Media"].forEach((s) => sizes.add(s));
    else if (v.startsWith("grande")) sizes.add("Grande");
    else if (v === "startup") ["Micro", "Piccola"].forEach((s) => sizes.add(s));
    else sizes.add(d); // PA, ETS, Privati, Liberi professionisti: non matchano le imprese
  }
  return sizes.size ? [...sizes] : ["*"];
}

async function fetchDetail(url: string) {
  try {
    const $ = cheerio.load(await fetchHtml(url));
    $("script, style, nav, header, footer").remove();
    const text = $("main").first().text().replace(/\s+/g, " ").trim() || $("body").text().replace(/\s+/g, " ");
    const destinatari = (text.match(/Destinatari:\s*(.*?)\s*(?:Programmi:|Argomenti:)/)?.[1] ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const temi = [...new Set($(".rtds-card__tags .rtds-chip--category").map((_, el) =>
      $(el).text().replace(/Tema:/, "").trim()).get().filter(Boolean))];
    const deadline = parseItalianLongDate(text.match(/Scade il:\s*([^.]{0,40})/)?.[1] ?? null);
    const description = text.split(/Cos(?:'|&#039;|’)è/).slice(1).join(" ").trim() || text;
    return { destinatari, temi, deadline, description: description.slice(0, 6000) };
  } catch {
    return null; // il dettaglio è un arricchimento: non deve bloccare la sync
  }
}

export async function fetchSviluppoToscana(): Promise<Grant[]> {
  const delayMs = Math.max(0, Number(process.env.CAMCOM_LG_DELAY_MS ?? 400));

  const first = extractListing(await fetchHtml(LIST_URL));
  const listed = [...first.items];
  for (let page = 2; page <= Math.min(first.totalPages, 20); page++) {
    await sleep(delayMs);
    listed.push(...extractListing(await fetchHtml(`${LIST_URL}&_paged=${page}`)).items);
  }

  const grants: Grant[] = [];
  for (const item of new Map(listed.map((i) => [i.slug, i])).values()) {
    const detail = await fetchDetail(item.url);
    await sleep(delayMs);
    const topicText = [item.title, item.summary, detail?.description ?? ""].join(" ; ");

    grants.push({
      id: `SVTOS-${item.slug}`,
      title: item.title,
      ente: "Regione Toscana / Sviluppo Toscana",
      level: "Regionale",
      status: mapStatus(item.statusRaw),
      regions: ["Toscana"],
      sizes: mapSizes(detail?.destinatari ?? []),
      ateco_filter: ["*"],
      topics: [...new Set([...(detail?.temi ?? []), ...inferTopics(topicText)])],
      invest_min_eur: null,
      invest_max_eur: null,
      opening_date: null,
      deadline: detail?.deadline ?? null,
      aid_type: null,
      budget: null,
      url: item.url,
      source: SOURCE,
      source_updated_at: null,
      requirements: detail?.description || item.summary || "Verificare i requisiti sulla pagina ufficiale del bando.",
      raw: { ...item, destinatari: detail?.destinatari ?? [] },
      synced_at: new Date().toISOString(),
    });
  }
  return grants;
}
