"use client";

import { FormEvent, useState } from "react";
import type { Customer } from "@/lib/types";

const flags: Array<[keyof Customer, string]> = [
  ["digitale", "Digitale"],
  ["green", "Green"],
  ["ricerca_sviluppo", "R&S"],
  ["cloud_cyber", "Cloud / Cyber"],
  ["investimenti_beni", "Beni strumentali"],
  ["export", "Export"],
  ["formazione", "Formazione"],
];

export function CustomerEditForm({ customer }: { customer: Customer }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload: Record<string, FormDataEntryValue | boolean> =
      Object.fromEntries(form.entries());

    for (const [name] of flags) {
      payload[String(name)] = form.get(String(name)) === "on";
    }

    const response = await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Aggiornamento fallito.");
      setBusy(false);
      return;
    }

    setMessage("Cliente aggiornato.");
    setBusy(false);
    setTimeout(() => window.location.reload(), 500);
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <div className="field">
        <label>ID cliente</label>
        <input name="external_id" defaultValue={customer.external_id} required />
      </div>
      <div className="field">
        <label>Ragione sociale</label>
        <input name="ragione_sociale" defaultValue={customer.ragione_sociale} required />
      </div>
      <div className="field">
        <label>Regione</label>
        <input name="regione" defaultValue={customer.regione} required />
      </div>
      <div className="field">
        <label>Provincia</label>
        <input name="provincia" defaultValue={customer.provincia ?? ""} />
      </div>
      <div className="field">
        <label>ATECO</label>
        <input name="ateco" defaultValue={customer.ateco ?? ""} />
      </div>
      <div className="field">
        <label>Dimensione</label>
        <select name="dimensione" defaultValue={customer.dimensione}>
          <option>Micro</option>
          <option>Piccola</option>
          <option>Media</option>
          <option>Grande</option>
          <option>Professionista</option>
        </select>
      </div>
      <div className="field">
        <label>Dipendenti</label>
        <input name="dipendenti" type="number" min="0" defaultValue={customer.dipendenti ?? ""} />
      </div>
      <div className="field">
        <label>Fatturato €</label>
        <input name="fatturato_eur" type="number" min="0" step="0.01" defaultValue={customer.fatturato_eur ?? ""} />
      </div>
      <div className="field">
        <label>Investimento previsto €</label>
        <input name="investimento_previsto_eur" type="number" min="0" step="0.01" defaultValue={customer.investimento_previsto_eur ?? ""} />
      </div>
      <div className="checks">
        {flags.map(([name, label]) => (
          <label key={String(name)}>
            <input
              type="checkbox"
              name={String(name)}
              defaultChecked={Boolean(customer[name])}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="field full">
        <label>Note</label>
        <textarea name="note" rows={3} defaultValue={customer.note ?? ""} />
      </div>
      {message && (
        <div className={`${message.includes("aggiornato") ? "success-box" : "error"} field full`}>
          {message}
        </div>
      )}
      <div className="actions field full">
        <button className="btn" disabled={busy}>
          {busy ? "Salvataggio…" : "Salva modifiche"}
        </button>
      </div>
    </form>
  );
}
