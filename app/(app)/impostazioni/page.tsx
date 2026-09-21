import { SCORE_WEIGHTS } from "@/lib/scoring";
import { isTeamleaderConnected } from "@/lib/integrations/teamleader";
import { getRecentSyncRuns } from "@/lib/data";
import { StatusBadge } from "@/components/status-badge";
import { TeamleaderSyncButton } from "@/components/teamleader-sync-button";
import { TeamleaderDisconnectButton } from "@/components/teamleader-disconnect-button";

export const dynamic = "force-dynamic";

function dt(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value)
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const teamleaderFeedback = typeof params.teamleader === "string" ? params.teamleader : "";
  const teamleaderMessage =
    typeof params.teamleader_message === "string" ? params.teamleader_message : "";

  const env = [
    ["DATABASE_URL", Boolean(process.env.DATABASE_URL)],
    ["APP_PASSWORD", Boolean(process.env.APP_PASSWORD)],
    ["AUTH_SECRET", Boolean(process.env.AUTH_SECRET)],
    ["CRON_SECRET", Boolean(process.env.CRON_SECRET)],
  ];

  const [connected, syncRuns] = await Promise.all([
    isTeamleaderConnected(),
    getRecentSyncRuns(),
  ]);
  const lastTeamleaderSync = syncRuns.find((run) => run.source === "teamleader") ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Impostazioni</h1>
          <p>Parametri tecnici, logica di scoring e integrazioni.</p>
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
        <h2>Integrazioni</h2>

        {teamleaderFeedback === "connected" && (
          <div className="success-box">Account Teamleader collegato correttamente.</div>
        )}
        {teamleaderFeedback === "error" && (
          <div className="error">
            Connessione a Teamleader non riuscita{teamleaderMessage ? `: ${teamleaderMessage}` : "."}
          </div>
        )}

        <div className="source-card" style={{ marginTop: 12 }}>
          <span className={`badge ${connected ? "open" : ""}`}>
            {connected ? "Connesso" : "Non connesso"}
          </span>
          <strong>Teamleader Focus — Clienti</strong>
          <p className="muted">
            Sincronizzazione in sola lettura: importa le aziende da Teamleader nell&apos;anagrafica Clienti
            usata dal motore di matching. I campi settore/regione/dimensione si mappano dai custom field
            Teamleader configurati nelle Environment Variables (TEAMLEADER_CF_*); i flag digitale/green/export/ecc.
            si ricavano dai tag assegnati alle aziende.
          </p>

          <div className="actions">
            {connected ? (
              <>
                <TeamleaderSyncButton />
                <TeamleaderDisconnectButton />
              </>
            ) : (
              <a className="btn" href="/api/integrations/teamleader/connect">
                Connetti a Teamleader
              </a>
            )}
          </div>

          {lastTeamleaderSync && (
            <p className="muted small" style={{ marginTop: 10 }}>
              Ultima sincronizzazione: {dt(lastTeamleaderSync.finished_at)} ·{" "}
              <StatusBadge value={lastTeamleaderSync.status} /> · {lastTeamleaderSync.records} clienti
              {lastTeamleaderSync.message ? ` · ${lastTeamleaderSync.message}` : ""}
            </p>
          )}
        </div>
      </section>

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
