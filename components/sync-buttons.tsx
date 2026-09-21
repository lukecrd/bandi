"use client";

import { useState } from "react";

export function SyncButtons() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function run(source: "incentivi" | "eu" | "camcom-lg") {
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

    const label =
      source === "eu" ? "UE" : source === "camcom-lg" ? "CCIAA Maremma e Tirreno" : "Italia";
    setMessage(`${label}: ${result.records} bandi aggiornati.`);
    setBusy(null);
    setTimeout(() => window.location.reload(), 800);
  }

  return (
    <div className="grid">
      <div className="actions">
        <button className="btn" onClick={() => run("incentivi")} disabled={Boolean(busy)}>
          {busy === "incentivi" ? "Sincronizzazione…" : "Sincronizza Italia"}
        </button>
        <button className="btn secondary" onClick={() => run("eu")} disabled={Boolean(busy)}>
          {busy === "eu" ? "Sincronizzazione…" : "Sincronizza UE"}
        </button>
        <button className="btn secondary" onClick={() => run("camcom-lg")} disabled={Boolean(busy)}>
          {busy === "camcom-lg" ? "Sincronizzazione…" : "Sincronizza CCIAA Maremma e Tirreno"}
        </button>
      </div>
      {message && <div className={message.includes("fallita") ? "error" : "success-box"}>{message}</div>}
    </div>
  );
}
