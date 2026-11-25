import type { QuestionarioCliente } from "@/components/questionario";
import { codiciCliente } from "@/lib/ateco";
import { provincia } from "@/lib/province";
import { haTemi } from "@/lib/scoring";
import type { Customer } from "@/lib/types";

/** Dati senza i quali non si può dire quali bandi si adattano al cliente: vanno chiesti. */
export function datiMancanti(c: Customer) {
  return ([
    ["territorio", (!c.regione && !provincia(c.provincia)) || !c.provincia],
    // "Micro" è il valore di default dell'import: senza numeri non è una risposta
    ["dimensione", c.dipendenti === null && c.fatturato_eur === null && c.dimensione === "Micro"],
    ["ATECO", !codiciCliente(c.ateco || c.anagrafica?.ateco).length],
    ["temi", !haTemi(c)],
  ] as const).filter(([, manca]) => manca).map(([dato]) => dato);
}

export type DatoMancante = ReturnType<typeof datiMancanti>[number];

/** Solo i campi che servono al questionario: niente anagrafica completa (IBAN, documenti) nel browser. */
export function questionarioCliente(c: Customer): QuestionarioCliente {
  return {
    id: c.id, external_id: c.external_id, ragione_sociale: c.ragione_sociale,
    partita_iva: c.anagrafica?.partita_iva ?? "", regione: c.regione || provincia(c.provincia)?.regione || "",
    provincia: c.provincia, ateco: c.ateco || c.anagrafica?.ateco || null,
    dimensione: c.dimensione, dipendenti: c.dipendenti, fatturato_eur: c.fatturato_eur,
    investimento_previsto_eur: c.investimento_previsto_eur, digitale: c.digitale, green: c.green,
    ricerca_sviluppo: c.ricerca_sviluppo, cloud_cyber: c.cloud_cyber, investimenti_beni: c.investimenti_beni,
    export: c.export, formazione: c.formazione, note: c.note, mancanti: datiMancanti(c),
  };
}
