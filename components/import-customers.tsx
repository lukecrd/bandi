"use client";

import { FormEvent, useState } from "react";

export function ImportCustomers() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/customers/import", {
      method: "POST",
      body: form,
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Import fallito.");
      setBusy(false);
      return;
    }

    setMessage(`Importati/aggiornati ${result.records} clienti.`);
    setTimeout(() => window.location.reload(), 700);
  }

  return (
    <form onSubmit={submit} className="grid">
      <div className="field">
        <label>File clienti (.xlsx o .csv)</label>
        <input name="file" type="file" accept=".xlsx,.csv" required />
      </div>
      <button className="btn secondary" disabled={busy}>
        {busy ? "Importazione…" : "Importa clienti"}
      </button>
      {message && <div className={message.startsWith("Importati") ? "success-box" : "error"}>{message}</div>}
      <div className="muted small">
        Le intestazioni del foglio Excel originale sono riconosciute automaticamente.
      </div>
    </form>
  );
}
