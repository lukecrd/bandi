"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DeMinimis } from "@/lib/types";

const itDate = (iso: string) => iso.split("-").reverse().join("/");

// Fuso e raggruppamento espliciti: server e browser devono produrre lo stesso testo (hydration).
const ROME_DATE = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" });
const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: true });

const LINK = { textDecoration: "underline" };

export function DeMinimisPanel({ customerId, cf, dati }: { customerId: string; cf: string; dati: DeMinimis | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function sync() {
    setBusy(true);
    setDone(false);
    setError("");
    try {
      const response = await fetch("/api/sync-de-minimis", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        setError(result.error ?? "Aggiornamento da RNA non riuscito.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Connessione interrotta: l'aggiornamento potrebbe essere ancora in corso. Ricarica la pagina tra qualche minuto.");
    } finally {
      setBusy(false);
    }
  }

  const verificato = dati && ROME_DATE.format(new Date(dati.verificato_il));

  return (
    <div className="grid">
      {!cf ? (
        <p className="muted">
          Codice fiscale mancante o non valido (11 cifre o 16 caratteri): inseriscilo e salvalo nella scheda cliente, in{" "}
          <Link href={`/clienti/${customerId}`} style={LINK}>«Dati per compilazione bandi»</Link>.
        </p>
      ) : !dati ? (
        <div className="notice"><b>Mai verificato.</b></div>
      ) : dati.aiuti.length === 0 ? (
        <div className="success-box">
          <b>Nessun aiuto De Minimis negli ultimi 3 anni</b> per il codice fiscale {cf} (verifica del {verificato}).
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data concessione</th>
                <th>Misura</th>
                <th>Regolamento</th>
                <th>COR</th>
                <th>Elemento di aiuto</th>
              </tr>
            </thead>
            <tbody>
              {dati.aiuti.map((a, i) => (
                <tr key={i}>
                  <td className="nowrap">{itDate(a.data_concessione)}</td>
                  <td>
                    {a.misura}
                    {a.progetto && <div className="muted small">{a.progetto}</div>}
                    {a.concedente && <div className="muted small">{a.concedente}</div>}
                  </td>
                  <td>{a.regolamento}</td>
                  <td>{a.cor}</td>
                  <td className="nowrap">{EURO.format(a.elemento_aiuto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={4}>Totale degli aiuti in elenco</th>
                <td className="nowrap"><b>{EURO.format(dati.aiuti.reduce((sum, a) => sum + a.elemento_aiuto, 0))}</b></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {cf && (
        <div className="actions">
          <button className="btn" type="button" disabled={busy} onClick={sync}>
            {busy ? "Aggiornamento in corso…" : "Aggiorna da RNA"}
          </button>
          <span className="muted" role="status">
            {busy && "Rilettura degli open data RNA per tutti i clienti: richiede alcuni minuti, tieni aperta la pagina."}
            {done && "Aggiornamento completato."}
          </span>
        </div>
      )}

      {error && <div className="error" role="alert">{error}</div>}

      <p className="small muted">
        Fonte:{" "}
        <a href="https://www.incentivitalia.gov.it/open-data/aiuti" target="_blank" rel="noreferrer" style={LINK}>
          open data del Registro Nazionale degli Aiuti
        </a>{" "}
        (CC BY 4.0){verificato && `, dati verificati il ${verificato}`}. Gli open data sono aggiornati ogni settimana e
        riguardano solo questo codice fiscale, non l&apos;«impresa unica» (gruppo). Gli aiuti agricoli e della pesca (registri SIAN e SIPA) possono non comparire.{" "}
        <a href="https://www.incentivitalia.gov.it/rna/rna-trasparenza/aiuti" target="_blank" rel="noreferrer" style={LINK}>
          Verifica in tempo reale sul portale RNA
        </a>
      </p>
    </div>
  );
}
