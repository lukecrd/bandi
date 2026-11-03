import { NextResponse } from "next/server";
import { z } from "zod";
import { AssistenteError, runAssistente } from "@/lib/assistente";

export const maxDuration = 120;

// Autenticazione: la sessione è verificata da proxy.ts per tutte le /api non pubbliche.
const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(40)
    .refine((m) => m[0].role === "user" && m[m.length - 1].role === "user", {
      message: "La conversazione deve iniziare e terminare con un messaggio dell'utente.",
    }),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Richiesta non valida." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({ answer: await runAssistente(parsed.data.messages) });
  } catch (error) {
    if (error instanceof AssistenteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("assistente", error);
    return NextResponse.json({ error: "Errore interno dell'assistente." }, { status: 500 });
  }
}
