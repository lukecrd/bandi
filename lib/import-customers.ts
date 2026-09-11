import ExcelJS from "exceljs";
import type { CustomerInput } from "@/lib/types";

type RawRow = Record<string, unknown>;

function header(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function get(row: RawRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[header(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function str(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function num(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[€$]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function bool(value: unknown) {
  return ["si", "sì", "yes", "true", "1", "x"].includes(
    String(value ?? "").trim().toLocaleLowerCase("it-IT")
  );
}

function rowToCustomer(row: RawRow, index: number): CustomerInput | null {
  const ragione = str(get(row, ["ragione_sociale", "ragione sociale", "cliente", "azienda"]));
  if (!ragione) return null;

  return {
    external_id:
      str(get(row, ["id_cliente", "id cliente", "id", "codice_cliente"])) ??
      `IMPORT-${Date.now()}-${index}`,
    ragione_sociale: ragione,
    regione: str(get(row, ["regione"])) ?? "",
    provincia: str(get(row, ["provincia"])),
    ateco: str(get(row, ["ateco", "codice_ateco"])),
    dimensione: str(get(row, ["dimensione", "dimensione_impresa"])) ?? "Micro",
    dipendenti: num(get(row, ["dipendenti"])) !== null ? Math.round(num(get(row, ["dipendenti"]))!) : null,
    fatturato_eur: num(get(row, ["fatturato_eur", "fatturato", "fatturato eur"])),
    investimento_previsto_eur: num(
      get(row, ["investimento_previsto_eur", "investimento previsto eur", "investimento_previsto", "investimento"])
    ),
    digitale: bool(get(row, ["digitale"])),
    green: bool(get(row, ["green"])),
    ricerca_sviluppo: bool(get(row, ["r_s", "r&s", "ricerca_sviluppo", "ricerca e sviluppo"])),
    cloud_cyber: bool(get(row, ["cloud_cyber", "cloud cyber", "cloud/cyber"])),
    investimenti_beni: bool(get(row, ["investimenti_beni", "investimenti beni"])),
    export: bool(get(row, ["export"])),
    formazione: bool(get(row, ["formazione"])),
    note: str(get(row, ["note"])),
  };
}

function parseCsvLine(line: string, delimiter: string) {
  const out: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      out.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }

  out.push(cell);
  return out;
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (!lines.length) return [];

  const delimiter =
    (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const headers = parseCsvLine(lines[0], delimiter).map(header);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

export async function parseCustomerFile(file: File) {
  const name = file.name.toLocaleLowerCase("it-IT");
  let rawRows: RawRow[] = [];

  if (name.endsWith(".csv")) {
    rawRows = parseCsv(await file.text());
  } else if (name.endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()));
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("Il file Excel non contiene fogli.");

    const headers = new Map<number, string>();
    sheet.getRow(1).eachCell((cell, col) => headers.set(col, header(cell.text)));

    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex++) {
      const raw: RawRow = {};
      for (const [col, key] of headers) {
        raw[key] = sheet.getCell(rowIndex, col).text;
      }
      rawRows.push(raw);
    }
  } else {
    throw new Error("Formato non supportato. Usa .xlsx oppure .csv.");
  }

  if (rawRows.length > 5000) {
    throw new Error("Massimo 5.000 clienti per import.");
  }

  const customers = rawRows
    .map((row, index) => rowToCustomer(row, index + 2))
    .filter((row): row is CustomerInput => Boolean(row));

  if (!customers.length) {
    throw new Error("Nessun cliente valido trovato. Verifica le intestazioni del file.");
  }

  return customers;
}
