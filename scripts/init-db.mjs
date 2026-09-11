import fs from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL mancante");
  process.exit(1);
}

const sql = neon(url);
const schema = await fs.readFile(new URL("../db/schema.sql", import.meta.url), "utf8");

const statements = schema
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}

console.log(`Database inizializzato: ${statements.length} statement eseguiti.`);
