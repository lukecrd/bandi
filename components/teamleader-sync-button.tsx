"use client";

import { useState } from "react";

export function TeamleaderSyncButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");

    const response = await fetch("/api/sync-customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "teamleader" }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Sincronizzazione fallita.");
      setBusy(false);
      return;
    }

    setMessage(`${result.records} clienti aggiornati da Teamleader.`);
    setBusy(false);
    setTimeout(() => window.location.reload(), 800);
  }

  return (
    <div className="grid">
      <button className="btn" onClick={run} disabled={busy}>
        {busy ? "Sincronizzazione…" : "Sincronizza clienti da Teamleader"}
      </button>
      {message && (
        <div className={message.includes("fallita") ? "error" : "success-box"}>{message}</div>
      )}
    </div>
  );
}
