import { db } from "@/lib/db";
import type { Customer, CustomerInput, Grant, IntegrationToken } from "@/lib/types";

export async function getDashboardStats() {
  const sql = db();
  const [row] = await sql.query(
    `SELECT
      (SELECT COUNT(*)::int FROM customers) AS customers,
      (SELECT COUNT(*)::int FROM grants WHERE status = 'Aperto') AS open_grants,
      (SELECT COUNT(*)::int FROM grants WHERE status = 'In arrivo') AS forthcoming_grants,
      (SELECT MAX(finished_at) FROM sync_runs WHERE status = 'success') AS last_sync`
  );
  return row as {
    customers: number;
    open_grants: number;
    forthcoming_grants: number;
    last_sync: string | null;
  };
}

export async function getCustomers(search = "") {
  const sql = db();
  const rows = await sql.query(
    `SELECT *
     FROM customers
     WHERE $1 = ''
        OR ragione_sociale ILIKE '%' || $1 || '%'
        OR external_id ILIKE '%' || $1 || '%'
        OR regione ILIKE '%' || $1 || '%'
        OR COALESCE(ateco, '') ILIKE '%' || $1 || '%'
     ORDER BY ragione_sociale
     LIMIT 1000`,
    [search]
  );
  return rows as Customer[];
}

export async function getCustomer(id: string) {
  const sql = db();
  const rows = await sql.query(`SELECT * FROM customers WHERE id = $1 LIMIT 1`, [id]);
  return (rows[0] ?? null) as Customer | null;
}

export async function createCustomer(input: CustomerInput) {
  const sql = db();
  const rows = await sql.query(
    `INSERT INTO customers (
      external_id, ragione_sociale, regione, provincia, ateco, dimensione,
      dipendenti, fatturato_eur, investimento_previsto_eur,
      digitale, green, ricerca_sviluppo, cloud_cyber, investimenti_beni,
      export, formazione, note
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
    )
    RETURNING *`,
    [
      input.external_id,
      input.ragione_sociale,
      input.regione,
      input.provincia,
      input.ateco,
      input.dimensione,
      input.dipendenti,
      input.fatturato_eur,
      input.investimento_previsto_eur,
      input.digitale,
      input.green,
      input.ricerca_sviluppo,
      input.cloud_cyber,
      input.investimenti_beni,
      input.export,
      input.formazione,
      input.note,
    ]
  );
  return rows[0] as Customer;
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const sql = db();
  const rows = await sql.query(
    `UPDATE customers SET
      external_id = $2,
      ragione_sociale = $3,
      regione = $4,
      provincia = $5,
      ateco = $6,
      dimensione = $7,
      dipendenti = $8,
      fatturato_eur = $9,
      investimento_previsto_eur = $10,
      digitale = $11,
      green = $12,
      ricerca_sviluppo = $13,
      cloud_cyber = $14,
      investimenti_beni = $15,
      export = $16,
      formazione = $17,
      note = $18,
      updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.external_id,
      input.ragione_sociale,
      input.regione,
      input.provincia,
      input.ateco,
      input.dimensione,
      input.dipendenti,
      input.fatturato_eur,
      input.investimento_previsto_eur,
      input.digitale,
      input.green,
      input.ricerca_sviluppo,
      input.cloud_cyber,
      input.investimenti_beni,
      input.export,
      input.formazione,
      input.note,
    ]
  );
  return (rows[0] ?? null) as Customer | null;
}

export async function deleteCustomer(id: string) {
  const sql = db();
  await sql.query(`DELETE FROM customers WHERE id = $1`, [id]);
}

export async function upsertCustomers(inputs: CustomerInput[]) {
  if (!inputs.length) return 0;
  const sql = db();

  for (let i = 0; i < inputs.length; i += 100) {
    const chunk = inputs.slice(i, i + 100);
    const queries = chunk.map((input) => sql`
      INSERT INTO customers (
        external_id, ragione_sociale, regione, provincia, ateco, dimensione,
        dipendenti, fatturato_eur, investimento_previsto_eur,
        digitale, green, ricerca_sviluppo, cloud_cyber, investimenti_beni,
        export, formazione, note
      ) VALUES (
        ${input.external_id}, ${input.ragione_sociale}, ${input.regione},
        ${input.provincia}, ${input.ateco}, ${input.dimensione},
        ${input.dipendenti}, ${input.fatturato_eur}, ${input.investimento_previsto_eur},
        ${input.digitale}, ${input.green}, ${input.ricerca_sviluppo},
        ${input.cloud_cyber}, ${input.investimenti_beni}, ${input.export},
        ${input.formazione}, ${input.note}
      )
      ON CONFLICT (external_id) DO UPDATE SET
        ragione_sociale = EXCLUDED.ragione_sociale,
        regione = EXCLUDED.regione,
        provincia = EXCLUDED.provincia,
        ateco = EXCLUDED.ateco,
        dimensione = EXCLUDED.dimensione,
        dipendenti = EXCLUDED.dipendenti,
        fatturato_eur = EXCLUDED.fatturato_eur,
        investimento_previsto_eur = EXCLUDED.investimento_previsto_eur,
        digitale = EXCLUDED.digitale,
        green = EXCLUDED.green,
        ricerca_sviluppo = EXCLUDED.ricerca_sviluppo,
        cloud_cyber = EXCLUDED.cloud_cyber,
        investimenti_beni = EXCLUDED.investimenti_beni,
        export = EXCLUDED.export,
        formazione = EXCLUDED.formazione,
        note = EXCLUDED.note,
        updated_at = NOW()
    `);
    await sql.transaction(queries);
  }

  return inputs.length;
}

export async function getGrants(options?: {
  search?: string;
  source?: string;
  status?: string;
  limit?: number;
}) {
  const sql = db();
  const search = options?.search ?? "";
  const source = options?.source ?? "";
  const status = options?.status ?? "";
  const limit = Math.min(Math.max(options?.limit ?? 2000, 1), 10000);

  const rows = await sql.query(
    `SELECT *
     FROM grants
     WHERE ($1 = '' OR title ILIKE '%' || $1 || '%' OR COALESCE(ente,'') ILIKE '%' || $1 || '%')
       AND ($2 = '' OR source = $2)
       AND ($3 = '' OR status = $3)
     ORDER BY
       CASE status WHEN 'Aperto' THEN 0 WHEN 'In arrivo' THEN 1 ELSE 2 END,
       deadline NULLS LAST,
       title
     LIMIT $4`,
    [search, source, status, limit]
  );
  return rows as Grant[];
}

export async function getActiveGrants(limit = 10000) {
  const sql = db();
  const rows = await sql.query(
    `SELECT *
     FROM grants
     WHERE status IN ('Aperto', 'In arrivo')
       AND (deadline IS NULL OR deadline >= CURRENT_DATE)
     ORDER BY deadline NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return rows as Grant[];
}

export async function upsertGrants(grants: Grant[]) {
  if (!grants.length) return 0;
  const sql = db();

  for (let i = 0; i < grants.length; i += 100) {
    const chunk = grants.slice(i, i + 100);
    const queries = chunk.map((g) => sql`
      INSERT INTO grants (
        id, title, ente, level, status, regions, sizes, ateco_filter, topics,
        invest_min_eur, invest_max_eur, opening_date, deadline, aid_type,
        budget, url, source, source_updated_at, requirements, raw, synced_at
      ) VALUES (
        ${g.id}, ${g.title}, ${g.ente}, ${g.level}, ${g.status},
        ${g.regions}, ${g.sizes}, ${g.ateco_filter}, ${g.topics},
        ${g.invest_min_eur}, ${g.invest_max_eur}, ${g.opening_date},
        ${g.deadline}, ${g.aid_type}, ${g.budget}, ${g.url}, ${g.source},
        ${g.source_updated_at}, ${g.requirements}, ${JSON.stringify(g.raw)},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        ente = EXCLUDED.ente,
        level = EXCLUDED.level,
        status = EXCLUDED.status,
        regions = EXCLUDED.regions,
        sizes = EXCLUDED.sizes,
        ateco_filter = EXCLUDED.ateco_filter,
        topics = EXCLUDED.topics,
        invest_min_eur = EXCLUDED.invest_min_eur,
        invest_max_eur = EXCLUDED.invest_max_eur,
        opening_date = EXCLUDED.opening_date,
        deadline = EXCLUDED.deadline,
        aid_type = EXCLUDED.aid_type,
        budget = EXCLUDED.budget,
        url = EXCLUDED.url,
        source = EXCLUDED.source,
        source_updated_at = EXCLUDED.source_updated_at,
        requirements = EXCLUDED.requirements,
        raw = EXCLUDED.raw,
        synced_at = NOW()
    `);
    await sql.transaction(queries);
  }

  return grants.length;
}

export async function closeExpiredGrants() {
  const sql = db();
  await sql.query(
    `UPDATE grants
     SET status = 'Chiuso', synced_at = NOW()
     WHERE status <> 'Chiuso'
       AND deadline IS NOT NULL
       AND deadline < CURRENT_DATE`
  );
}

export async function startSyncRun(source: string) {
  const sql = db();
  const rows = await sql.query(
    `INSERT INTO sync_runs (source, status)
     VALUES ($1, 'running')
     RETURNING id`,
    [source]
  );
  return String(rows[0].id);
}

export async function finishSyncRun(
  id: string,
  status: "success" | "error",
  records: number,
  message: string | null
) {
  const sql = db();
  await sql.query(
    `UPDATE sync_runs
     SET status = $2, records = $3, message = $4, finished_at = NOW()
     WHERE id = $1`,
    [id, status, records, message]
  );
}

export async function getRecentSyncRuns() {
  const sql = db();
  return (await sql.query(
    `SELECT *
     FROM sync_runs
     ORDER BY started_at DESC
     LIMIT 30`
  )) as Array<{
    id: string;
    source: string;
    status: string;
    records: number;
    message: string | null;
    started_at: string;
    finished_at: string | null;
  }>;
}

export async function getIntegrationToken(provider: string) {
  const sql = db();
  const rows = await sql.query(
    `SELECT * FROM integration_tokens WHERE provider = $1 LIMIT 1`,
    [provider]
  );
  return (rows[0] ?? null) as IntegrationToken | null;
}

export async function saveIntegrationToken(
  provider: string,
  tokens: { access_token: string; refresh_token: string; expires_at: string }
) {
  const sql = db();
  await sql.query(
    `INSERT INTO integration_tokens (provider, access_token, refresh_token, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (provider) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [provider, tokens.access_token, tokens.refresh_token, tokens.expires_at]
  );
}

export async function deleteIntegrationToken(provider: string) {
  const sql = db();
  await sql.query(`DELETE FROM integration_tokens WHERE provider = $1`, [provider]);
}
