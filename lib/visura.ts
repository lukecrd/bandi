import type { Anagrafica } from "@/lib/types";

// shortcut: label-based regexes on the visura ordinaria layout (Registro Imprese/Telemaco); scanned PDFs have no text and return nothing, add OCR if they become common.

const MESI = "ABCDEHLMPRST";
const CF_PERSONA = /\b[A-Z]{6}\d{2}[A-EHLMPRST]\d{2}[A-Z]\d{3}[A-Z]\b/;

const toIso = (d: string) => d.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1");
const clean = (s: string | undefined) => s?.replace(/\s+/g, " ").trim() || undefined;

/** Value on the same line after `label`, or on the next non-empty line. */
function after(text: string, label: RegExp): string | undefined {
  const m = text.match(new RegExp(label.source + "[ \\t:]*([^\\n]*)\\n?\\s*([^\\n]*)", "i"));
  return m ? clean(m[1] || m[2]) : undefined;
}

const consonanti = (s: string) => s.replace(/[^B-DF-HJ-NP-TV-Z]/g, "");
const vocali = (s: string) => s.replace(/[^AEIOU]/g, "");
const pad = (s: string) => (s + "XXX").slice(0, 3);

export function cfCognome(cognome: string) {
  const s = cognome.toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
  return pad(consonanti(s) + vocali(s));
}

export function cfNome(nome: string) {
  const s = nome.toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
  const c = consonanti(s);
  return c.length >= 4 ? c[0] + c[2] + c[3] : pad(c + vocali(s));
}

/** Birth date (yyyy-mm-dd) from a personal codice fiscale; century guessed (adults only). */
export function dataNascitaDaCf(cf: string): string | undefined {
  if (!CF_PERSONA.test(cf)) return undefined;
  const yy = Number(cf.slice(6, 8));
  const mm = MESI.indexOf(cf[8]) + 1;
  const dd = Number(cf.slice(9, 11)) % 40;
  const year = yy + (yy > (new Date().getFullYear() % 100) ? 1900 : 2000);
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Finds "COGNOME NOME" (visura order) at the end of `text`, using the codice fiscale to pick the words and the boundary. */
export function splitNome(text: string, cf: string) {
  const words = text.trim().toUpperCase().split(/\s+/);
  for (let start = words.length - 2; start >= 0; start--) {
    for (let i = start + 1; i < words.length; i++) {
      const cognome = words.slice(start, i).join(" ");
      const nome = words.slice(i).join(" ");
      if (cfCognome(cognome) === cf.slice(0, 3) && cfNome(nome) === cf.slice(3, 6)) return { cognome, nome };
    }
  }
  return undefined;
}

function legaleRappresentante(text: string): Partial<Anagrafica> {
  const role = text.search(/rappresentante dell'impresa|amministratore unico|titolare firmatario|presidente del consiglio/i);
  const from = Math.max(role, 0);
  const cf = text.slice(from).match(CF_PERSONA)?.[0];
  if (!cf) return {};
  // the name and "Nato a" sit before the role label, so cut the block from the whole text
  const at = text.indexOf(cf, from);
  const block = text.slice(Math.max(0, at - 400), at + 400);
  const nascita = block.match(/([A-ZÀ-Ü' ]{3,}?)\s+nat[oa] a\s+([A-ZÀ-Ü' ]+?)\s*\(([A-Z]{2})\)\s*il\s*(\d{2}\/\d{2}\/\d{4})/i);
  // the visura prints the role after the name: "BARLETTANI MASSIMO Rappresentante dell'impresa"
  const nome = nascita ? splitNome(nascita[1].replace(/\s*rappresentante dell'impresa.*$/i, ""), cf) : undefined;
  return {
    lr_codice_fiscale: cf,
    lr_cognome: nome?.cognome,
    lr_nome: nome?.nome,
    lr_luogo_nascita: nascita ? `${clean(nascita[2])?.toUpperCase()} (${nascita[3].toUpperCase()})` : undefined,
    lr_data_nascita: nascita ? toIso(nascita[4]) : dataNascitaDaCf(cf),
  };
}

export function parseVisura(raw: string): Partial<Anagrafica> {
  const text = raw.replace(/\r/g, "");
  // the address wraps over several lines: "MONTE ARGENTARIO (GR)\nVIA DEL MOLO 16 CAP\n58019 FRAZIONE: ..."
  const sede = clean(text.match(/Indirizzo Sede legale[ \t:]*([\s\S]*?)(?=\n\s*(?:Domicilio digitale|Indirizzo PEC|Numero REA|Partita IVA|Codice fiscale)|$)/i)?.[1]);
  const sedeParts = sede?.match(/^(.+?)\s*\(([A-Z]{2})\)\s*(.*?)(?:\s*\bfrazione\b.*)?$/i);
  const data = text.match(/Data (?:atto di )?costituzione[\s:]*(\d{2}\/\d{2}\/\d{4})/i)?.[1];

  const result: Partial<Anagrafica> = {
    denominazione: after(text, /Denominazione/) ?? after(text, /VISURA (?:ORDINARIA|STORICA)[^\n]*/),
    partita_iva: text.match(/Partita IVA[\s:]*(\d{11})/i)?.[1],
    codice_fiscale:
      text.match(/Registro Imprese[\s:]*(\d{11}|[A-Z0-9]{16})\b/i)?.[1] ??
      text.match(/Codice fiscale[\s:]*(\d{11})\b/i)?.[1],
    forma_giuridica: after(text, /Forma giuridica/),
    pec: text.match(/(?:Indirizzo PEC|Domicilio digitale\/PEC)[\s:]*([\w.+-]+@[\w.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase(),
    rea: clean(text.match(/Numero REA[\s:]*([A-Z]{2}\s*-?\s*\d+)/i)?.[1]),
    data_costituzione: data ? toIso(data) : undefined,
    ateco: text.match(/(?:Codice ATECO|ATECO[^\n:]*:)[\s:]*(\d{2}(?:\.\d{1,2}){0,2})/i)?.[1],
    capitale_sociale: text.match(/Capitale sociale[^\d\n]*([\d.]+,\d{2})/i)?.[1],
    sede_comune: clean(sedeParts?.[1]),
    sede_provincia: sedeParts?.[2],
    sede_indirizzo: clean(sedeParts?.[3]?.replace(/\bCAP\b\s*(\d{5})?/i, "")),
    sede_cap: sede?.match(/\b(\d{5})\b/)?.[1],
    ...legaleRappresentante(text),
  };
  return Object.fromEntries(Object.entries(result).filter(([, v]) => v)) as Partial<Anagrafica>;
}
