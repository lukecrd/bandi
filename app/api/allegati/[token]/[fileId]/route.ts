import { NextResponse } from "next/server";
import { verifyAllegatiToken } from "@/lib/auth";
import { getCustomerFileContent } from "@/lib/data";
import { CORS, fileHeaders } from "@/lib/allegati";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  const customerId = await verifyAllegatiToken(token);
  if (!customerId) return NextResponse.json({ error: "Link non valido." }, { status: 401, headers: CORS });
  const file = UUID.test(fileId) ? await getCustomerFileContent(customerId, fileId) : null;
  if (!file) return NextResponse.json({ error: "File non trovato." }, { status: 404, headers: CORS });
  return new Response(new Uint8Array(file.content), { headers: { ...fileHeaders(file), ...CORS } });
}
