import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Client } from "@/lib/types";
import * as XLSX from "xlsx";

type ExcelRow = Record<string, unknown>;
type ImportedClientFields = Pick<Client, "ragione_sociale" | "partita_iva" | "regione" | "citta" | "codici_ateco">;

const columnAliases: Record<keyof ImportedClientFields, string[]> = {
  ragione_sociale: ["ragione sociale", "denominazione sociale", "denominazione", "nome azienda", "nome impresa", "azienda", "impresa", "company name", "nome"],
  partita_iva: ["partita iva", "p iva", "piva", "vat number"],
  regione: ["regione", "regione sede"],
  citta: ["citta", "comune", "localita", "sede legale citta"],
  codici_ateco: ["codici ateco", "codice ateco", "codice ape", "ateco", "cod ateco"],
};

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toText(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function normalizeRow(row: ExcelRow) {
  const columns = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  const valueFor = (aliases: string[]) => {
    const normalizedAliases = aliases.map(normalizeHeader);
    for (const alias of normalizedAliases) {
      const exactMatch = columns.get(alias);
      if (exactMatch !== undefined) return exactMatch;
    }
    for (const [header, value] of columns) {
      if (normalizedAliases.some((alias) => header.includes(alias))) return value;
    }
    return undefined;
  };

  return Object.fromEntries(
    Object.entries(columnAliases).map(([field, aliases]) => [
      field,
      toText(valueFor(aliases)),
    ]),
  ) as ImportedClientFields;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ error: "Il file non contiene fogli" }, { status: 400 });
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: "", raw: false });
    const headers = Object.keys(rows[0] || {});
    const hasCompanyColumn = headers.some((header) =>
      columnAliases.ragione_sociale.some((alias) => normalizeHeader(header).includes(normalizeHeader(alias))),
    );
    if (rows.length > 0 && !hasCompanyColumn) {
      return NextResponse.json({
        error: `Colonna azienda non riconosciuta. Intestazioni trovate: ${headers.join(", ") || "nessuna"}`,
      }, { status: 400 });
    }

    const importedClients: Client[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = normalizeRow(rows[i]);
      if (!row.ragione_sociale || row.ragione_sociale.trim() === "") {
        errors.push(`Riga ${i + 2}: manca la ragione sociale`);
        continue;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      try {
        db.prepare(`
          INSERT INTO clients (id, ragione_sociale, partita_iva, citta, codici_ateco, settore, regione, taglia_aziendale, requisiti, note, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, row.ragione_sociale, row.partita_iva || "", row.citta || "", row.codici_ateco || "",
          "", row.regione || "", "", "", "", now, now
        );

        const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Client;
        importedClients.push(client);
      } catch (err: any) {
        errors.push(`Riga ${i + 2}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedClients.length,
      errors,
      clients: importedClients,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
