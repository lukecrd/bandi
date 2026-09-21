"use client";

import { useState } from "react";

export function TeamleaderDisconnectButton() {
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (!confirm("Scollegare l'account Teamleader? Le sincronizzazioni si fermeranno.")) return;
    setBusy(true);
    const response = await fetch("/api/integrations/teamleader/disconnect", { method: "POST" });
    if (response.ok) window.location.reload();
    else setBusy(false);
  }

  return (
    <button className="btn danger" disabled={busy} onClick={disconnect}>
      {busy ? "Disconnessione…" : "Scollega Teamleader"}
    </button>
  );
}
