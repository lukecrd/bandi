"use client";

import { FormEvent, useState } from "react";
import { ITALY_REGIONS } from "@/lib/italy-points";
import type { DatoMancante } from "@/lib/questionario";

export type QuestionarioCliente = {
  id: string;
  external_id: string;
  ragione_sociale: string;
  partita_iva: string;
  regione: string;
  provincia: string | null;
  ateco: string | null;
  dimensione: string;
  dipendenti: number | null;
  fatturato_eur: number | null;
  investimento_previsto_eur: number | null;
  digitale: boolean;
  green: boolean;
  ricerca_sviluppo: boolean;
  cloud_cyber: boolean;
  investimenti_beni: boolean;
  export: boolean;
  formazione: boolean;
  note: string | null;
  mancanti: DatoMancante[];
};

const REGIONI = ITALY_REGIONS.map((r) => r.name).sort((a, b) => a.localeCompare(b, "it"));

const DIMENSIONI = [
  { value: "Professionista", label: "Libero professionista", hint: "Lavoratore autonomo con partita IVA" },
  { value: "Micro", label: "Micro impresa", hint: "Meno di 10 addetti e fatturato fino a 2 milioni" },
  { value: "Piccola", label: "Piccola impresa", hint: "Meno di 50 addetti e fatturato fino a 10 milioni" },
  { value: "Media", label: "Media impresa", hint: "Meno di 250 addetti e fatturato fino a 50 milioni" },
  { value: "Grande", label: "Grande impresa", hint: "250 addetti o più" },
];

const INTERESSI = [
  { key: "digitale", label: "Digitalizzazione, software, e-commerce" },
  { key: "cloud_cyber", label: "Cloud e sicurezza informatica" },
  { key: "investimenti_beni", label: "Macchinari, attrezzature, beni strumentali" },
  { key: "green", label: "Efficienza energetica, fotovoltaico, sostenibilità" },
  { key: "ricerca_sviluppo", label: "Ricerca, sviluppo, innovazione" },
  { key: "export", label: "Export e fiere all'estero" },
  { key: "formazione", label: "Formazione del personale" },
] as const;

type Interesse = (typeof INTERESSI)[number]["key"];

const VUOTO = {
  ragione_sociale: "", partita_iva: "", regione: "", provincia: "", ateco: "",
  dimensione: "", dipendenti: "", fatturato_eur: "", investimento_previsto_eur: "", note: "",
};

/** Soglie UE (Raccomandazione 2003/361): conta il numero di addetti e, se c'è, il fatturato. */
export function suggestedSize(dipendenti: string, fatturato: string) {
  const d = dipendenti === "" ? null : Number(dipendenti);
  const f = fatturato === "" ? null : Number(fatturato);
  if (d === null && f === null) return null;
  const within = (maxD: number, maxF: number) => (d === null || d < maxD) && (f === null || f <= maxF);
  if (within(10, 2_000_000)) return "Micro";
  if (within(50, 10_000_000)) return "Piccola";
  if (within(250, 50_000_000)) return "Media";
  return "Grande";
}

const str = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));

// L'import Excel ha regioni scritte a mano ("TOSCANA", "Friuli Venezia Giulia"): le riportiamo ai nomi dell'elenco.
const regionKey = (name: string) => name.split("/")[0].toLowerCase().replace(/-/g, " ").trim();
const canonicalRegion = (name: string) => REGIONI.find((r) => regionKey(r) === regionKey(name)) ?? "";

function valori(c: QuestionarioCliente | undefined) {
  if (!c) return VUOTO;
  return {
    ragione_sociale: c.ragione_sociale, partita_iva: c.partita_iva, regione: canonicalRegion(c.regione),
    provincia: str(c.provincia), ateco: str(c.ateco),
    dimensione: c.mancanti.includes("dimensione") ? "" : c.dimensione,
    dipendenti: str(c.dipendenti), fatturato_eur: str(c.fatturato_eur),
    investimento_previsto_eur: str(c.investimento_previsto_eur), note: str(c.note),
  };
}

const scelte = (c: QuestionarioCliente | undefined) =>
  Object.fromEntries(INTERESSI.map((i) => [i.key, c?.[i.key] ?? false])) as Record<Interesse, boolean>;

/** Con `solo` chiede a quel cliente soltanto i dati che mancano. */
export function Questionario({ clienti, solo }: { clienti: QuestionarioCliente[]; solo?: QuestionarioCliente }) {
  const [clienteId, setClienteId] = useState(solo?.id ?? "");
  const [form, setForm] = useState(() => valori(solo));
  const [interessi, setInteressi] = useState(() => scelte(solo));
  const chiedi = (dato: DatoMancante) => !solo || solo.mancanti.includes(dato);
  // La dimensione segue i numeri finché l'utente non la sceglie a mano.
  const [sizeTouched, setSizeTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const cliente = clienti.find((c) => c.id === clienteId);
  const suggerita = suggestedSize(form.dipendenti, form.fatturato_eur);

  function scegliCliente(id: string) {
    setClienteId(id);
    setError("");
    const c = clienti.find((x) => x.id === id);
    setForm(valori(c));
    setInteressi(scelte(c));
    setSizeTouched(false);
  }

  function set(field: keyof typeof VUOTO, value: string) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (!sizeTouched && (field === "dipendenti" || field === "fatturato_eur")) {
        const s = suggestedSize(next.dipendenti, next.fatturato_eur);
        if (s) next.dimensione = s;
      }
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const piva = form.partita_iva.replace(/\s/g, "");
    if (piva && !/^\d{11}$/.test(piva)) {
      setError("La partita IVA deve avere 11 cifre.");
      return;
    }
    if (solo?.mancanti.includes("temi") && !Object.values(interessi).some(Boolean)) {
      setError("Indica almeno una cosa che vorrebbe finanziare.");
      return;
    }
    if (!form.dimensione) {
      setError("Indica che tipo di soggetto è (micro, piccola, media impresa…).");
      return;
    }

    setBusy(true);
    const body = {
      external_id: cliente?.external_id ?? `Q-${Date.now().toString(36).toUpperCase()}`,
      ragione_sociale: form.ragione_sociale.trim(),
      // più regioni ("Toscana, Lazio") non stanno nel menu: resta quella salvata
      regione: form.regione || cliente?.regione || "",
      provincia: form.provincia.trim(),
      ateco: form.ateco.trim(),
      dimensione: form.dimensione,
      dipendenti: form.dipendenti,
      fatturato_eur: form.fatturato_eur,
      investimento_previsto_eur: form.investimento_previsto_eur,
      note: form.note.trim(),
      ...interessi,
      // In modifica la partita IVA si unisce all'anagrafica esistente; in creazione la apre.
      ...(piva ? (cliente ? { anagrafica_merge: { partita_iva: piva } } : { anagrafica: { partita_iva: piva } }) : {}),
    };

    const response = await fetch(cliente ? `/api/customers/${cliente.id}` : "/api/customers", {
      method: cliente ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Salvataggio non riuscito.");
      setBusy(false);
      return;
    }
    // La scheda cliente mostra subito i bandi compatibili con il profilo appena salvato.
    window.location.href = `/clienti/${result.id}`;
  }

  return (
    <form onSubmit={submit} className="questionario">
      {!solo && <fieldset>
        <legend>Azienda</legend>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="q-cliente">Per quale cliente?</label>
            <select id="q-cliente" value={clienteId} onChange={(e) => scegliCliente(e.target.value)}>
              <option value="">Nuova azienda</option>
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ragione_sociale}{c.mancanti.length > 0 && ` · mancano: ${c.mancanti.join(", ")}`}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="q-ragione">Ragione sociale</label>
            <input id="q-ragione" value={form.ragione_sociale} onChange={(e) => set("ragione_sociale", e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="q-piva">Partita IVA</label>
            <input id="q-piva" value={form.partita_iva} onChange={(e) => set("partita_iva", e.target.value)}
              inputMode="numeric" placeholder="11 cifre" aria-describedby="q-piva-hint" />
            <span id="q-piva-hint" className="muted small">Serve per i controlli in visura e sui portali dei bandi.</span>
          </div>
        </div>
      </fieldset>}

      {chiedi("territorio") && <fieldset>
        <legend>Dove opera</legend>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="q-regione">Regione della sede operativa</label>
            <select id="q-regione" value={form.regione} onChange={(e) => set("regione", e.target.value)} required>
              <option value="">Scegli…</option>
              {REGIONI.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="q-provincia">Provincia</label>
            <input id="q-provincia" value={form.provincia} onChange={(e) => set("provincia", e.target.value)} placeholder="es. Firenze o FI" required={!!solo} />
          </div>
        </div>
      </fieldset>}

      {chiedi("dimensione") && <fieldset>
        <legend>Dimensione</legend>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="q-dipendenti">Quante persone ci lavorano?</label>
            <input id="q-dipendenti" type="number" min="0" required={!!solo} value={form.dipendenti} onChange={(e) => set("dipendenti", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="q-fatturato">Fatturato annuo (€)</label>
            <input id="q-fatturato" type="number" min="0" step="1000" value={form.fatturato_eur} onChange={(e) => set("fatturato_eur", e.target.value)} />
          </div>
        </div>
        <div className="choice-list" role="radiogroup" aria-labelledby="q-dim-title">
          <p id="q-dim-title" className="field-title">
            Che tipo di soggetto è?
            {suggerita && <span className="muted small"> Dai numeri risulta: {DIMENSIONI.find((d) => d.value === suggerita)?.label}.</span>}
          </p>
          {DIMENSIONI.map((d) => (
            <label key={d.value} className="choice">
              <input type="radio" name="q-dimensione" value={d.value} checked={form.dimensione === d.value}
                onChange={() => { setSizeTouched(true); set("dimensione", d.value); }} />
              <span><strong>{d.label}</strong> <span className="muted small">{d.hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>}

      {chiedi("ATECO") && <fieldset>
        <legend>Settore</legend>
        <div className="field">
          <label htmlFor="q-ateco">Codice ATECO</label>
          <input id="q-ateco" value={form.ateco} onChange={(e) => set("ateco", e.target.value)} placeholder="es. 62.01 oppure 25" required={!!solo} pattern="\s*\d{2}[\d.\s,;\/]*" title="Almeno le prime due cifre, es. 56 o 56.30.01" aria-describedby="q-ateco-hint" />
          <span id="q-ateco-hint" className="muted small">Si trova in visura camerale. Bastano le prime due cifre se non si conosce il codice completo.</span>
        </div>
      </fieldset>}

      {chiedi("temi") && <fieldset>
        <legend>Progetti nei prossimi 12 mesi</legend>
        <div className="choice-list">
          <p className="field-title">Cosa vorrebbe finanziare?</p>
          {INTERESSI.map((i) => (
            <label key={i.key} className="choice">
              <input type="checkbox" checked={interessi[i.key]} onChange={(e) => setInteressi((s) => ({ ...s, [i.key]: e.target.checked }))} />
              <span>{i.label}</span>
            </label>
          ))}
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="q-investimento">Quanto pensa di investire (€)?</label>
            <input id="q-investimento" type="number" min="0" step="1000" value={form.investimento_previsto_eur} onChange={(e) => set("investimento_previsto_eur", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="q-note">Altro da sapere</label>
            <input id="q-note" value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="es. impresa femminile, startup, under 35" />
          </div>
        </div>
      </fieldset>}

      {error && <div className="error" role="alert">{error}</div>}
      <div className="actions">
        <button className="btn" disabled={busy}>
          {busy ? "Salvataggio…" : cliente ? "Aggiorna e trova i bandi" : "Salva e trova i bandi"}
        </button>
      </div>
    </form>
  );
}
