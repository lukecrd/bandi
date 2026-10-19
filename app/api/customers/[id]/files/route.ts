import { NextResponse } from "next/server";
import { addCustomerFile } from "@/lib/data";
import { MAX_FILE_BYTES, TIPI_ALLEGATO } from "@/lib/allegati";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Cliente non valido." }, { status: 400 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Richiesta multipart non valida." }, { status: 400 });
  }
  const file = form.get("file");
  const tipo = String(form.get("tipo") ?? "");
  const data = String(form.get("data_documento") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File mancante o vuoto." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File troppo grande (max 4 MB)." }, { status: 413 });
  }
  if (!(TIPI_ALLEGATO as readonly string[]).includes(tipo)) {
    return NextResponse.json({ error: "Tipo documento non valido." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) {
    return NextResponse.json({ error: "Data documento non valida." }, { status: 400 });
  }

  try {
    const saved = await addCustomerFile(id, {
      tipo,
      data_documento: data,
      filename: file.name.slice(0, 200),
      mime: file.type || "application/octet-stream",
      content: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("customer file upload failed", error);
    return NextResponse.json({ error: "Salvataggio del file non riuscito." }, { status: 500 });
  }
}
