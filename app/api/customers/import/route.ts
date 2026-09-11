import { NextResponse } from "next/server";
import { parseCustomerFile } from "@/lib/import-customers";
import { upsertCustomers } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File mancante." }, { status: 400 });
    }

    const customers = await parseCustomerFile(file);
    const records = await upsertCustomers(customers);
    return NextResponse.json({ ok: true, records });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
