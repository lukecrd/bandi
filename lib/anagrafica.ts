import { z } from "zod";
import type { Anagrafica } from "@/lib/types";

const s = () => z.string().optional();

// unknown keys are stripped (z.object default)
export const AnagraficaSchema = z.object({
  partita_iva: s(), codice_fiscale: s(), denominazione: s(), forma_giuridica: s(),
  pec: s(), rea: s(), data_costituzione: s(),
  sede_indirizzo: s(), sede_cap: s(), sede_comune: s(), sede_provincia: s(),
  ateco: s(), capitale_sociale: s(),
  lr_nome: s(), lr_cognome: s(), lr_codice_fiscale: s(), lr_data_nascita: s(), lr_luogo_nascita: s(),
  lr_documento_tipo: s(), lr_documento_numero: s(), lr_documento_rilascio: s(), lr_documento_scadenza: s(), lr_documento_ente: s(),
}) satisfies z.ZodType<Anagrafica>;
