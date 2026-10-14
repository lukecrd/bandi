import { fetchEUFunding } from "@/lib/sources/eu";
import { fetchIncentiviGov } from "@/lib/sources/incentivi";
import { CHAMBERS, fetchCamCom } from "@/lib/sources/camcom";
import { fetchSviluppoToscana } from "@/lib/sources/sviluppo-toscana";
import {
  closeExpiredGrants,
  finishSyncRun,
  startSyncRun,
  upsertGrants,
} from "@/lib/data";
import type { SyncSource } from "@/lib/types";

function fetchSource(source: SyncSource) {
  switch (source) {
    case "incentivi": return fetchIncentiviGov();
    case "eu": return fetchEUFunding();
    case "sviluppo-toscana": return fetchSviluppoToscana();
    default: return fetchCamCom(CHAMBERS[source]);
  }
}

export async function runSync(source: SyncSource) {
  const runId = await startSyncRun(source);

  try {
    await closeExpiredGrants();

    const grants = await fetchSource(source);

    const count = await upsertGrants(grants);
    await finishSyncRun(runId, "success", count, null);

    return { source, records: count, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSyncRun(runId, "error", 0, message);
    throw error;
  }
}
