"use client";

import { useState } from "react";
import { SYNC_SOURCES, type SyncSource } from "@/lib/sync-sources";

export function SyncButtons() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function run(source: SyncSource) {
    setBusy(source);
    setMessage("");

    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Sincronizzazione fallita.");
      setBusy(null);
      return;
    }

    setMessage(`${SYNC_SOURCES[source]}: ${result.records} bandi aggiornati.`);
    setBusy(null);
    setTimeout(() => window.location.reload(), 800);
  }

  return (
    <div className="grid">
      <div className="actions">
        {(Object.keys(SYNC_SOURCES) as SyncSource[]).map((source, i) => (
          <button
            key={source}
            className={i === 0 ? "btn" : "btn secondary"}
            onClick={() => run(source)}
            disabled={Boolean(busy)}
          >
            {busy === source ? "Sincronizzazione…" : `Sincronizza ${SYNC_SOURCES[source]}`}
          </button>
        ))}
      </div>
      {message && <div className={message.includes("bandi aggiornati") ? "success-box" : "error"}>{message}</div>}
    </div>
  );
}
