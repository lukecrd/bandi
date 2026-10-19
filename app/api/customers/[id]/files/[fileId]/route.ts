import { NextResponse } from "next/server";
import { deleteCustomerFile, getCustomerFileContent, updateCustomerFile } from "@/lib/data";
import { fileHeaders } from "@/lib/allegati";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; fileId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ids(params: Params["params"]) {
  const { id, fileId } = await params;
  return UUID.test(id) && UUID.test(fileId) ? { id, fileId } : null;
}

export async function GET(_request: Request, { params }: Params) {
  const p = await ids(params);
  const file = p && (await getCustomerFileContent(p.id, p.fileId));
  if (!file) return NextResponse.json({ error: "File non trovato." }, { status: 404 });
  return new Response(new Uint8Array(file.content), { headers: fileHeaders(file) });
}

export async function PATCH(request: Request, { params }: Params) {
  const p = await ids(params);
  if (!p) return NextResponse.json({ error: "File non trovato." }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (typeof body?.da_caricare !== "boolean") {
    return NextResponse.json({ error: "Valore non valido." }, { status: 400 });
  }
  const file = await updateCustomerFile(p.id, p.fileId, body.da_caricare);
  if (!file) return NextResponse.json({ error: "File non trovato." }, { status: 404 });
  return NextResponse.json(file);
}

export async function DELETE(_request: Request, { params }: Params) {
  const p = await ids(params);
  if (!p) return NextResponse.json({ error: "File non trovato." }, { status: 404 });
  await deleteCustomerFile(p.id, p.fileId);
  return NextResponse.json({ ok: true });
}
