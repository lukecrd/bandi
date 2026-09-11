"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: form.get("password") }),
    });

    if (!response.ok) {
      setError("Password non valida.");
      setBusy(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get("from") || "/";
  }

  return (
    <form onSubmit={submit} className="grid">
      <div className="field">
        <label>Password</label>
        <input name="password" type="password" autoFocus required />
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn" disabled={busy}>
        {busy ? "Accesso…" : "Accedi"}
      </button>
    </form>
  );
}
