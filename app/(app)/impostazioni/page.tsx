import { SCORE_WEIGHTS } from "@/lib/scoring";

export default function SettingsPage() {
  const env = [
    ["DATABASE_URL", Boolean(process.env.DATABASE_URL)],
    ["APP_PASSWORD", Boolean(process.env.APP_PASSWORD)],
    ["AUTH_SECRET", Boolean(process.env.AUTH_SECRET)],
    ["CRON_SECRET", Boolean(process.env.CRON_SECRET)],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Impostazioni</h1>
          <p>Parametri tecnici e logica di scoring.</p>
        </div>
      </div>

      <div className="grid two">
        <section className="card">
          <h2>Pesi matching</h2>
          <table style={{ minWidth: 0 }}>
            <tbody>
              {Object.entries(SCORE_WEIGHTS).map(([name, value]) => (
                <tr key={name}>
                  <td style={{ textTransform: "capitalize" }}>{name}</td>
                  <td><strong>{value}</strong></td>
                </tr>
              ))}
              <tr><td>Totale</td><td><strong>100</strong></td></tr>
            </tbody>
          </table>
          <p className="muted small">
            Soglia minima corrente: {process.env.MATCH_MIN_SCORE ?? "50"}.
            Modifica MATCH_MIN_SCORE nelle Environment Variables di Vercel.
          </p>
        </section>

        <section className="card">
          <h2>Environment Variables</h2>
          <table style={{ minWidth: 0 }}>
            <tbody>
              {env.map(([name, ok]) => (
                <tr key={String(name)}>
                  <td className="mono">{name}</td>
                  <td>{ok ? <span className="badge success">Configurata</span> : <span className="badge error">Mancante</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div style={{ height: 18 }} />

      <section className="card">
        <h2>Nota sul matching</h2>
        <p>
          Il punteggio è un pre-screening. La verifica finale dei requisiti formali,
          degli ATECO ammessi/esclusi, dei regimi di aiuto e della documentazione
          deve essere eseguita sulla fonte ufficiale del singolo bando.
        </p>
      </section>
    </>
  );
}
