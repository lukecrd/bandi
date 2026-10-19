import { NextResponse } from "next/server";
import { verifyAllegatiToken } from "@/lib/auth";
import { listCustomerFiles } from "@/lib/data";
import { CORS } from "@/lib/allegati";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customerId = await verifyAllegatiToken(token);
  if (!customerId) return NextResponse.json({ error: "Link non valido." }, { status: 401, headers: CORS });

  const base = new URL(request.url);
  const files = await listCustomerFiles(customerId, true);
  return NextResponse.json(
    files.map((f) => ({
      tipo: f.tipo,
      data: f.data_documento.split("-").reverse().join("/"), // ReStart wants gg/mm/aaaa
      filename: f.filename,
      mime: f.mime,
      url: new URL(`/api/allegati/${token}/${f.id}`, base).toString(),
    })),
    { headers: CORS }
  );
}
