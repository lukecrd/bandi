"use client";

import { useState } from "react";
import { SYNC_SOURCES, type SyncSource } from "@/lib/sync-sources";

const SOURCES = Object.keys(SYNC_SOURCES) as SyncSource[];

async function syncOne(source: SyncSource) {
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Sincronizzazione fallita.");
  return Number(result.records ?? 0);
}

export function SyncButtons() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(true);

  async function run(source: SyncSource) {
    setBusy(source);
    setMessage("");
    try {
      const records = await syncOne(source);
      setOk(true);
      setMessage(`${SYNC_SOURCES[source]}: ${records} bandi aggiornati.`);
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setOk(false);
      setMessage(error instanceof Error ? error.message : "Sincronizzazione fallita.");
    }
    setBusy(null);
  }

  // Una fonte alla volta: ogni sync può durare minuti e in parallelo si sovrapporrebbero sul DB.
  async function runAll() {
    setBusy("all");
    let total = 0;
    const failed: string[] = [];
    for (const [i, source] of SOURCES.entries()) {
      setMessage(`Sincronizzazione ${i + 1} di ${SOURCES.length}: ${SYNC_SOURCES[source]}…`);
      try {
        total += await syncOne(source);
      } catch {
        failed.push(SYNC_SOURCES[source]);
      }
    }
    setOk(failed.length === 0);
    setMessage(
      `${total} bandi aggiornati da ${SOURCES.length - failed.length} fonti.` +
        (failed.length ? ` Non riuscite: ${failed.join(", ")} (dettagli nella tabella sotto).` : "")
    );
    setBusy(null);
    setTimeout(() => window.location.reload(), failed.length ? 2500 : 800);
  }

  return (
    <div className="sync-panel">
      <div className="actions">
        <button className="btn" onClick={runAll} disabled={Boolean(busy)}>
          {busy === "all" ? "Sincronizzazione in corso…" : "Sincronizza tutte le fonti"}
        </button>
      </div>
      <details className="sync-more">
        <summary>Sincronizza una sola fonte</summary>
        <div className="actions">
          {SOURCES.map((source) => (
            <button key={source} className="btn secondary" onClick={() => run(source)} disabled={Boolean(busy)}>
              {busy === source ? "Sincronizzazione…" : SYNC_SOURCES[source]}
            </button>
          ))}
        </div>
      </details>
      {message && (
        <div className={busy || ok ? "success-box" : "error"} role="status">
          {message}
        </div>
      )}
    </div>
  );
}
