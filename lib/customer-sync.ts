import { fetchTeamleaderCustomers } from "@/lib/integrations/teamleader";
import { startSyncRun, finishSyncRun, upsertCustomers } from "@/lib/data";
import type { CustomerSyncSource } from "@/lib/types";

export async function runCustomerSync(source: CustomerSyncSource) {
  const runId = await startSyncRun(source);

  try {
    const customers =
      source === "teamleader" ? await fetchTeamleaderCustomers() : [];

    const count = await upsertCustomers(customers);
    await finishSyncRun(runId, "success", count, null);

    return { source, records: count, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSyncRun(runId, "error", 0, message);
    throw error;
  }
}
