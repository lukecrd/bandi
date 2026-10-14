import { SCORE_WEIGHTS } from "@/lib/scoring";
import type { MatchResult } from "@/lib/types";

const CRITERIA = [
  ["score_regione", "Regione", SCORE_WEIGHTS.regione],
  ["score_dimensione", "Dimensione", SCORE_WEIGHTS.dimensione],
  ["score_ateco", "ATECO", SCORE_WEIGHTS.ateco],
  ["score_temi", "Temi", SCORE_WEIGHTS.temi],
  ["score_investimento", "Investimento", SCORE_WEIGHTS.investimento],
  ["score_tempistica", "Tempistica", SCORE_WEIGHTS.tempistica],
] as const;

const TICKS = [0, 25, 50, 75, 100];

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("it-IT").format(new Date(value)) : "—";
}

/** Barre orizzontali della compatibilità cliente–bando (0–100), con soglie di classe. */
export function MatchChart({ matches }: { matches: MatchResult[] }) {
  if (!matches.length) {
    return <p className="muted">Nessun bando attivo supera la soglia minima di compatibilità per questo cliente.</p>;
  }

  return (
    <>
      <div className="mchart" role="img" aria-label={`Compatibilità dei primi ${matches.length} bandi, da 0 a 100`}>
        <div className="mchart-axis" aria-hidden="true">
          {TICKS.map((t) => (
            <span key={t} style={{ left: `${t}%` }}>{t}</span>
          ))}
          <span className="mchart-threshold-label" style={{ left: "50%" }}>Media</span>
          <span className="mchart-threshold-label" style={{ left: "75%" }}>Alta</span>
        </div>

        {matches.map((m) => (
          <div className="mchart-row" key={m.grant.id} tabIndex={0}>
            <div className="mchart-label" title={m.grant.title}>{m.grant.title}</div>
            <div className="mchart-track">
              {TICKS.map((t) => <i key={t} className="mchart-grid" style={{ left: `${t}%` }} />)}
              <i className="mchart-grid threshold" style={{ left: "50%" }} />
              <i className="mchart-grid threshold" style={{ left: "75%" }} />
              <div className="mchart-bar" style={{ width: `${m.score_totale}%` }} />
              <span className="mchart-value" style={{ left: `${m.score_totale}%` }}>{m.score_totale}%</span>

              <div className="mchart-tip" role="tooltip">
                <strong>{m.score_totale}% · {m.classe}</strong>
                <span className="muted">{m.grant.source} · scad. {date(m.grant.deadline)}</span>
                <dl>
                  {CRITERIA.map(([key, label, max]) => (
                    <div key={key}><dt>{label}</dt><dd>{m[key]}/{max}</dd></div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        ))}
      </div>

      <details className="mchart-table">
        <summary>Mostra come tabella</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bando</th>
                <th>Totale</th>
                {CRITERIA.map(([key, label, max]) => <th key={key}>{label} /{max}</th>)}
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.grant.id}>
                  <td>
                    {m.grant.url
                      ? <a className="title-link" href={m.grant.url} target="_blank" rel="noreferrer">{m.grant.title} ↗</a>
                      : m.grant.title}
                  </td>
                  <td><strong>{m.score_totale}%</strong> <span className="muted small">{m.classe}</span></td>
                  {CRITERIA.map(([key]) => <td key={key}>{m[key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
