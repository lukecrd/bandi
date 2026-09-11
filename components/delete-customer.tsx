"use client";

import { useState } from "react";

export function DeleteCustomerButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Eliminare questo cliente?")) return;
    setBusy(true);
    const response = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (response.ok) window.location.href = "/clienti";
    else setBusy(false);
  }

  return (
    <button className="btn danger" disabled={busy} onClick={remove}>
      {busy ? "Eliminazione…" : "Elimina"}
    </button>
  );
}
