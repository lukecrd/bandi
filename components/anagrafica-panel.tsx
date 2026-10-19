"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Anagrafica } from "@/lib/types";
import { buildBookmarklet } from "@/lib/bookmarklet";
import { dataNascitaDaCf } from "@/lib/visura";

type Key = keyof Anagrafica;

const groups: Array<[string, Array<[Key, string, string?]>]> = [
  ["Società", [
    ["denominazione", "Denominazione"],
    ["partita_iva", "Partita IVA"],
    ["codice_fiscale", "Codice fiscale"],
    ["forma_giuridica", "Forma giuridica"],
    ["pec", "PEC", "email"],
    ["rea", "Numero REA"],
    ["data_costituzione", "Data costituzione"],
    ["ateco", "ATECO"],
    ["capitale_sociale", "Capitale sociale"],
  ]],
  ["Sede legale", [
    ["sede_indirizzo", "Indirizzo"],
    ["sede_cap", "CAP"],
    ["sede_comune", "Comune"],
    ["sede_provincia", "Provincia"],
  ]],
  ["Legale rappresentante", [
    ["lr_nome", "Nome"],
    ["lr_cognome", "Cognome"],
    ["lr_codice_fiscale", "Codice fiscale"],
    ["lr_data_nascita", "Data di nascita"],
    ["lr_luogo_nascita", "Luogo di nascita"],
  ]],
  ["Documento", [
    ["lr_documento_tipo", "Tipo documento"],
    ["lr_documento_numero", "Numero"],
    ["lr_documento_rilascio", "Data rilascio"],
    ["lr_documento_scadenza", "Data scadenza"],
    ["lr_documento_ente", "Rilasciato da"],
  ]],
  ["Conto corrente", [
    ["iban", "IBAN"],
    ["iban_intestatario", "Intestatario"],
  ]],
];

const same = (a: Anagrafica, b: Anagrafica) =>
  groups.every(([, fields]) => fields.every(([key]) => (a[key] ?? "") === (b[key] ?? "")));

export function AnagraficaPanel({ customerId, initial, dimensione }: { customerId: string; initial: Anagrafica; dimensione: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Anagrafica>(initial);
  const [extracted, setExtracted] = useState<Set<Key>>(new Set());
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const bookmarklet = useRef<HTMLAnchorElement>(null);
  const dirty = !same(form, initial);

  // React 19 blocks javascript: URLs in href props, so set it on the DOM node directly.
  useEffect(() => {
    bookmarklet.current?.setAttribute("href", buildBookmarklet({ ...initial, dimensione }));
  }, [initial, dimensione]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setReading(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/customers/${customerId}/documents`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Lettura documento fallita.");
      const estratti = (result.estratti ?? {}) as Partial<Anagrafica>;
      const changed = (Object.keys(estratti) as Key[]).filter((key) => estratti[key] && estratti[key] !== form[key]);
      setForm((current) => ({ ...current, ...Object.fromEntries(changed.map((key) => [key, estratti[key]])) }));
      setExtracted((current) => new Set([...current, ...changed]));
      setMessage(changed.length
        ? `Aggiornati ${changed.length} campi dal documento: controllali e salva.`
        : "Nessun dato nuovo trovato nel documento.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lettura documento fallita.");
    }
    setReading(false);
  }

  async function save() {
    setBusy(true);
    setMessage("");
    // same normalization as the API, so the saved data and the form stay equal
    const anagrafica = form.iban ? { ...form, iban: form.iban.replace(/\s+/g, "").toUpperCase() } : form;
    setForm(anagrafica);
    const response = await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anagrafica }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Salvataggio fallito.");
      return;
    }
    setExtracted(new Set());
    setMessage("Dati salvati.");
    router.refresh();
  }

  const ok = message.startsWith("Aggiornati") || message.startsWith("Dati salvati") || message.startsWith("Nessun");

  return (
    <div className="grid">
      <div className="actions">
        <label className="btn secondary focus-within:outline-2 focus-within:outline-offset-2" style={{ cursor: reading ? "wait" : "pointer", opacity: reading ? 0.55 : 1 }}>
          Carica visura camerale (PDF)
          <input type="file" accept=".pdf,application/pdf" className="sr-only" disabled={reading} onChange={upload} />
        </label>
        {reading && <span className="muted" role="status">Lettura documento in corso…</span>}
      </div>

      {groups.map(([title, fields]) => (
        <fieldset key={title} className="form-grid" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 800, marginBottom: 8 }}>{title}</legend>
          {fields.map(([key, label, type]) => {
            const id = `anagrafica-${key}`;
            const isNew = extracted.has(key);
            return (
              <div className="field" key={key}>
                <label htmlFor={id}>
                  {label} {isNew && <span style={{ color: "var(--green)" }}>· estratto</span>}
                </label>
                <input
                  id={id}
                  type={type ?? "text"}
                  value={form[key] ?? ""}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                  onBlur={key === "lr_codice_fiscale" && !form.lr_data_nascita ? () => {
                    const data = dataNascitaDaCf((form.lr_codice_fiscale ?? "").trim().toUpperCase());
                    if (data) setForm({ ...form, lr_data_nascita: data });
                  } : undefined}
                  style={isNew ? { borderColor: "#12b76a", background: "var(--green-soft)" } : undefined}
                />
              </div>
            );
          })}
        </fieldset>
      ))}

      {message && <div className={ok ? "success-box" : "error"} role="status">{message}</div>}

      <div className="actions">
        <button className="btn" type="button" onClick={save} disabled={busy || reading || !dirty}>
          {busy ? "Salvataggio…" : "Salva"}
        </button>
      </div>

      <div className="notice">
        <div className="actions">
          {/* href is set in useEffect */}
          <a ref={bookmarklet} className="btn secondary" onClick={(event) => event.preventDefault()}>
            Compila portale
          </a>
          <span className="small">
            Trascina questo pulsante nella barra dei preferiti, poi aprilo sulla pagina del bando.
          </span>
        </div>
        {dirty && (
          <div className="small" style={{ marginTop: 8 }}>
            Ci sono modifiche non salvate: il pulsante usa i dati salvati, premi “Salva” prima di trascinarlo.
          </div>
        )}
      </div>
    </div>
  );
}
