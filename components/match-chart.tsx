import Link from "next/link";
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

export type MatchChartItem = {
  id: string;
  label: string;
  detail: string;
  href?: string;
  match: MatchResult;
};

/** Barre orizzontali della compatibilità (0–100), con soglie di classe. */
export function MatchChart({ items, labelHeader }: { items: MatchChartItem[]; labelHeader: string }) {
  if (!items.length) {
    return <p className="muted">Nessun risultato supera la soglia minima di compatibilità.</p>;
  }

  return (
    <>
      <div className="mchart" role="img" aria-label={`Compatibilità di ${items.length} elementi, da 0 a 100`}>
        <div className="mchart-axis" aria-hidden="true">
          {TICKS.map((t) => (
            <span key={t} style={{ left: `${t}%` }}>{t}</span>
          ))}
          <span className="mchart-threshold-label" style={{ left: "50%" }}>Media</span>
          <span className="mchart-threshold-label" style={{ left: "75%" }}>Alta</span>
        </div>

        {items.map(({ id, label, detail, match: m }) => (
          <div className="mchart-row" key={id} tabIndex={0}>
            <div className="mchart-label" title={label}>{label}</div>
            <div className="mchart-track">
              {TICKS.map((t) => <i key={t} className="mchart-grid" style={{ left: `${t}%` }} />)}
              <i className="mchart-grid threshold" style={{ left: "50%" }} />
              <i className="mchart-grid threshold" style={{ left: "75%" }} />
              <div className="mchart-bar" style={{ width: `${m.score_totale}%` }} />
              <span className="mchart-value" style={{ left: `${m.score_totale}%` }}>{m.score_totale}%</span>

              <div className="mchart-tip" role="tooltip">
                <strong>{m.score_totale}% · {m.classe}</strong>
                <span className="muted">{detail}</span>
                <dl>
                  {CRITERIA.map(([key, criterion, max]) => (
                    <div key={key}><dt>{criterion}</dt><dd>{m[key]}/{max}</dd></div>
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
                <th>{labelHeader}</th>
                <th>Totale</th>
                {CRITERIA.map(([key, criterion, max]) => <th key={key}>{criterion} /{max}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map(({ id, label, detail, href, match: m }) => (
                <tr key={id}>
                  <td>
                    {href ? <Link className="title-link" href={href}>{label}</Link> : label}
                    <div className="muted small">{detail}</div>
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
