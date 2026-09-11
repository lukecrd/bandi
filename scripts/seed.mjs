import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL mancante");
  process.exit(1);
}

const sql = neon(url);

const customers = [
  [
    "CL001",
    "DEMO Mezzogiorno Srl",
    "Puglia",
    "BA",
    "25.62",
    "Piccola",
    18,
    2200000,
    500000,
    true,
    true,
    false,
    false,
    true,
    false,
    false,
    "Cliente dimostrativo"
  ],
  [
    "CL002",
    "DEMO Toscana Digital Srl",
    "Toscana",
    "FI",
    "62.01",
    "Micro",
    7,
    650000,
    80000,
    true,
    false,
    true,
    true,
    true,
    false,
    true,
    "Cliente dimostrativo"
  ]
];

for (const c of customers) {
  await sql.query(
    `INSERT INTO customers (
      external_id, ragione_sociale, regione, provincia, ateco, dimensione,
      dipendenti, fatturato_eur, investimento_previsto_eur,
      digitale, green, ricerca_sviluppo, cloud_cyber, investimenti_beni,
      export, formazione, note
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
    )
    ON CONFLICT (external_id) DO NOTHING`,
    c
  );
}

console.log("Clienti demo inseriti.");
