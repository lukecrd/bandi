"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NewGrant } from "@/lib/data";

// Per browser: ogni persona che usa l'app vede i bandi nuovi rispetto alla propria ultima visita.
const KEY = "bandimatch:grants-seen-at";

type Payload = { total: number; checkedAt: string | null; grants: NewGrant[] };

function read() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function write(value: string) {
  try { localStorage.setItem(KEY, value); } catch { /* storage bloccato: nessun alert */ }
}

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("it-IT").format(new Date(value)) : "—";
}

export function NewGrantsAlert() {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    const since = read();
    if (!since) {
      write(new Date().toISOString()); // prima visita: si parte da adesso
      return;
    }
    fetch(`/api/grants/new?since=${encodeURIComponent(since)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: Payload | null) => {
        if (payload?.total) setData(payload);
      })
      .catch(() => {}); // l'alert è accessorio: un errore non deve disturbare
  }, []);

  useEffect(() => {
    if (data && !ref.current?.open) ref.current?.showModal();
  }, [data]);

  // qualunque chiusura (pulsante, Esc, link) segna i bandi come visti
  function markSeen() {
    if (data?.checkedAt) write(data.checkedAt);
  }

  if (!data) return null;

  return (
    <dialog ref={ref} className="alert-dialog" onClose={markSeen} aria-labelledby="new-grants-title">
      <div className="alert-head">
        <h2 id="new-grants-title">
          {data.total === 1 ? "1 nuovo bando" : `${data.total} nuovi bandi`}
        </h2>
        <p className="muted small">Pubblicati dalle fonti dopo la tua ultima visita.</p>
      </div>

      <ul className="alert-list">
        {data.grants.map((g) => (
          <li key={g.id}>
            {g.url
              ? <a className="title-link" href={g.url} target="_blank" rel="noreferrer">{g.title} ↗</a>
              : <strong>{g.title}</strong>}
            <div className="muted small">
              {g.source} · {g.regions.includes("ITALIA") ? "Nazionale" : g.regions.join(", ")} · Scad. {date(g.deadline)}
              {g.status === "In arrivo" && " · In arrivo"}
            </div>
          </li>
        ))}
      </ul>
      {data.total > data.grants.length && (
        <p className="muted small">…e altri {data.total - data.grants.length}.</p>
      )}

      <form method="dialog" className="actions alert-actions">
        <Link className="btn secondary" href="/bandi" onClick={() => ref.current?.close()}>Vai ai bandi</Link>
        <button className="btn">Ho visto</button>
      </form>
    </dialog>
  );
}
