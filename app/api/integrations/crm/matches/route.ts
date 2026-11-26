import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveGrants } from "@/lib/data";
import { scoreAll } from "@/lib/scoring";
import type { Customer } from "@/lib/types";

// The CRM (crm-vivarelli.netlify.app) asks which open grants fit its companies, by partita IVA / codice fiscale.
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRM_API_KEY;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return Boolean(secret) && given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((x) => typeof x === "string" && /^[A-Z0-9]{11,16}$/.test(x))) {
    return NextResponse.json({ error: "ids: fino a 500 partite IVA o codici fiscali" }, { status: 400 });
  }
  if (!ids.length) return NextResponse.json({ results: [] });

  const customers = (await db().query(
    `SELECT * FROM customers
     WHERE anagrafica->>'partita_iva' = ANY($1) OR anagrafica->>'codice_fiscale' = ANY($1) OR external_id = ANY($1)`,
    [ids]
  )) as Customer[];
  const grants = await getActiveGrants(10000);

  return NextResponse.json({
    results: customers.map((c) => ({
      ids: [c.anagrafica?.partita_iva, c.anagrafica?.codice_fiscale, c.external_id].filter((x) => x && ids.includes(x)),
      ragione_sociale: c.ragione_sociale,
      matches: scoreAll(c, grants)
        .slice(0, 20)
        .map((m) => ({
          id: m.grant.id,
          title: m.grant.title,
          ente: m.grant.ente,
          deadline: m.grant.deadline,
          url: m.grant.url,
          aid_type: m.grant.aid_type,
          score: m.score_totale,
          motivi: m.motivi,
        })),
    })),
  });
}
