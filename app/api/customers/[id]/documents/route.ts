import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { parseVisura } from "@/lib/visura";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 50;
const TIMEOUT_MS = 15_000;

// `id` is unused: extraction does not touch the DB, the UI saves via PATCH after review
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Richiesta multipart non valida." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File mancante." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Carica la visura in formato PDF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File troppo grande (max 10 MB)." }, { status: 413 });
  }

  let text: string;
  try {
    // limits per unpdf's guidance for untrusted PDFs
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()), { maxImageSize: 16_777_216 });
    if (pdf.numPages > MAX_PAGES) {
      return NextResponse.json({ error: `Documento troppo lungo (max ${MAX_PAGES} pagine).` }, { status: 400 });
    }
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS));
    text = (await Promise.race([extractText(pdf, { mergePages: true }), timeout])).text as string;
  } catch (error) {
    console.error("visura pdf read failed", error);
    return NextResponse.json({ error: "Impossibile leggere il PDF." }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json(
      { error: "Il PDF non contiene testo (probabilmente è una scansione): scarica la visura originale dal Registro Imprese." },
      { status: 400 }
    );
  }

  return NextResponse.json({ estratti: parseVisura(text) });
}
