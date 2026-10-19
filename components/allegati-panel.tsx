"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_FILE_BYTES, TIPI_ALLEGATO, type CustomerFile } from "@/lib/allegati";

const itDate = (iso: string) => iso.split("-").reverse().join("/");

export function AllegatiPanel({ customerId, files }: { customerId: string; files: CustomerFile[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError("");
    const response = await fetch(url, init);
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "Operazione non riuscita.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (file && file.size > MAX_FILE_BYTES) {
      setError("File troppo grande (max 4 MB).");
      return;
    }
    if (await call(`/api/customers/${customerId}/files`, { method: "POST", body: new FormData(form) })) form.reset();
  }

  const toggle = (f: CustomerFile) =>
    call(`/api/customers/${customerId}/files/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ da_caricare: !f.da_caricare }),
    });

  const remove = (f: CustomerFile) =>
    confirm(`Eliminare "${f.filename}"?`) && call(`/api/customers/${customerId}/files/${f.id}`, { method: "DELETE" });

  const selected = files.filter((f) => f.da_caricare).length;

  return (
    <div className="grid">
      {files.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Da caricare</th>
                <th>Tipo documento</th>
                <th>Data documento</th>
                <th>File</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={f.da_caricare}
                      disabled={busy}
                      onChange={() => toggle(f)}
                      aria-label={`Carica ${f.filename} sul portale`}
                    />
                  </td>
                  <td>{f.tipo}</td>
                  <td>{itDate(f.data_documento)}</td>
                  <td>
                    <a href={`/api/customers/${customerId}/files/${f.id}`} target="_blank" rel="noreferrer">{f.filename}</a>
                    <span className="muted small"> · {Math.ceil(f.size / 1024)} KB</span>
                  </td>
                  <td>
                    <button className="btn danger" type="button" disabled={busy} onClick={() => remove(f)}>Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Nessun documento caricato.</p>
      )}

      <form className="form-grid" onSubmit={add}>
        <div className="field">
          <label htmlFor="allegato-tipo">Tipo documento</label>
          <select id="allegato-tipo" name="tipo" required defaultValue="">
            <option value="" disabled>Scegli il tipo</option>
            {TIPI_ALLEGATO.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="allegato-data">Data documento</label>
          <input id="allegato-data" name="data_documento" type="date" required />
        </div>
        <div className="field">
          <label htmlFor="allegato-file">File (max 4 MB)</label>
          <input id="allegato-file" name="file" type="file" required />
        </div>
        <div className="field" style={{ alignSelf: "end" }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Attendere…" : "Aggiungi documento"}</button>
        </div>
      </form>

      {error && <div className="error" role="status">{error}</div>}

      <p className="small muted">
        {selected} documenti selezionati. Nello step <b>Allegati</b> di ReStart il pulsante “Compila portale” li carica
        uno alla volta, con tipo e data.
      </p>
    </div>
  );
}
