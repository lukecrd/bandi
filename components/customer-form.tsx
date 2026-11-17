"use client";

import { FormEvent, useState } from "react";

const flags = [
  ["digitale", "Digitale"],
  ["green", "Green"],
  ["ricerca_sviluppo", "R&S"],
  ["cloud_cyber", "Cloud / Cyber"],
  ["investimenti_beni", "Beni strumentali"],
  ["export", "Export"],
  ["formazione", "Formazione"],
];

export function CustomerForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    for (const [name] of flags) {
      payload[name] = form.get(name) === "on" ? "true" : "false";
    }

    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Errore nel salvataggio.");
      setBusy(false);
      return;
    }

    window.location.href = `/clienti/${result.id}`;
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <div className="field">
        <label htmlFor="f-external_id">ID cliente</label>
        <input id="f-external_id" name="external_id" placeholder="es. CL003" required />
      </div>
      <div className="field">
        <label htmlFor="f-ragione_sociale">Ragione sociale</label>
        <input id="f-ragione_sociale" name="ragione_sociale" required />
      </div>
      <div className="field">
        <label htmlFor="f-regione">Regione</label>
        <input id="f-regione" name="regione" required />
      </div>
      <div className="field">
        <label htmlFor="f-provincia">Provincia</label>
        <input id="f-provincia" name="provincia" />
      </div>
      <div className="field">
        <label htmlFor="f-ateco">ATECO</label>
        <input id="f-ateco" name="ateco" placeholder="es. 62.01" />
      </div>
      <div className="field">
        <label htmlFor="f-dimensione">Dimensione</label>
        <select id="f-dimensione" name="dimensione" defaultValue="Micro">
          <option>Micro</option>
          <option>Piccola</option>
          <option>Media</option>
          <option>Grande</option>
          <option>Professionista</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="f-dipendenti">Dipendenti</label>
        <input id="f-dipendenti" name="dipendenti" type="number" min="0" />
      </div>
      <div className="field">
        <label htmlFor="f-fatturato_eur">Fatturato €</label>
        <input id="f-fatturato_eur" name="fatturato_eur" type="number" min="0" step="0.01" />
      </div>
      <div className="field">
        <label htmlFor="f-investimento_previsto_eur">Investimento previsto €</label>
        <input id="f-investimento_previsto_eur" name="investimento_previsto_eur" type="number" min="0" step="0.01" />
      </div>
      <div className="checks">
        {flags.map(([name, label]) => (
          <label key={name}>
            <input type="checkbox" name={name} /> {label}
          </label>
        ))}
      </div>
      <div className="field full">
        <label htmlFor="f-note">Note</label>
        <textarea id="f-note" name="note" rows={3} />
      </div>
      {message && <div className="error field full">{message}</div>}
      <div className="actions field full">
        <button className="btn" disabled={busy}>
          {busy ? "Salvataggio…" : "Crea cliente"}
        </button>
      </div>
    </form>
  );
}
