import { z } from "zod";

const optionalText = z.string().trim().optional().default("");

export const clientInputSchema = z.object({
  ragione_sociale: z.string().trim().min(1, "La ragione sociale è obbligatoria"),
  partita_iva: optionalText,
  citta: optionalText,
  codici_ateco: optionalText,
  settore: optionalText,
  regione: optionalText,
  taglia_aziendale: optionalText,
  requisiti: optionalText,
  note: optionalText,
});

export const bandInputSchema = z.object({
  titolo: z.string().trim().min(1, "Il titolo è obbligatorio"),
  ente: optionalText,
  regione: optionalText,
  settore: optionalText,
  importo: optionalText,
  scadenza: optionalText,
  requisiti: optionalText,
  descrizione: optionalText,
  link: optionalText,
  source: optionalText,
});

export const matchCreateSchema = z.object({
  clientId: z.string().trim().min(1, "clientId è obbligatorio"),
  bandId: z.string().trim().min(1, "bandId è obbligatorio"),
  score: z.number().min(0).max(100).optional().default(0),
  motivazione: optionalText,
});

export const matchComputeSchema = z.object({
  clientId: z.string().trim().min(1, "clientId è obbligatorio"),
});

export const domandaCreateSchema = z.object({
  client_id: z.string().trim().min(1, "client_id è obbligatorio"),
  band_id: z.string().trim().min(1, "band_id è obbligatorio"),
  note: z.string().trim().optional().default(""),
});

export const documentoCreateSchema = z.object({
  nome: z.string().trim().min(1, "Il nome è obbligatorio"),
  tipo: z.enum(["iban", "iscrizione_inps", "polizza_catastrofale", "visura", "fatture", "quietanza"]),
  size: z.number().min(0).optional().default(0),
  path: z.string().trim().optional().default(""),
});

export const moduloUpdateSchema = z.object({
  stato: z.enum(["vuoto", "parziale", "completo", "revisione"]).optional(),
  dati: z.record(z.string(), z.string()).optional(),
});
