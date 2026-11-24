import { fetchDeMinimis } from "@/lib/sources/rna";
import { finishSyncRun, getCustomerCfs, replaceDeMinimis, startSyncRun } from "@/lib/data";

export async function runDeMinimisSync() {
  const runId = await startSyncRun("rna-de-minimis");

  try {
    const aiuti = await fetchDeMinimis(await getCustomerCfs());

    await replaceDeMinimis(aiuti);
    await finishSyncRun(runId, "success", aiuti.size, null);

    return { ok: true, records: aiuti.size };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSyncRun(runId, "error", 0, message);
    throw error;
  }
}
