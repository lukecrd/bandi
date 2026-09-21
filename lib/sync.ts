import { fetchEUFunding } from "@/lib/sources/eu";
import { fetchIncentiviGov } from "@/lib/sources/incentivi";
import { fetchCamComLG } from "@/lib/sources/camcom-lg";
import {
  closeExpiredGrants,
  finishSyncRun,
  startSyncRun,
  upsertGrants,
} from "@/lib/data";
import type { SyncSource } from "@/lib/types";

export async function runSync(source: SyncSource) {
  const runId = await startSyncRun(source);

  try {
    await closeExpiredGrants();

    const grants =
      source === "incentivi"
        ? await fetchIncentiviGov()
        : source === "camcom-lg"
          ? await fetchCamComLG()
          : await fetchEUFunding();

    const count = await upsertGrants(grants);
    await finishSyncRun(runId, "success", count, null);

    return { source, records: count, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSyncRun(runId, "error", 0, message);
    throw error;
  }
}
