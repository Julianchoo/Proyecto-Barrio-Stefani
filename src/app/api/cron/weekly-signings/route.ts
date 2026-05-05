import { NextResponse } from "next/server";
import { sendWeeklySigningsSummary } from "@/lib/weekly-signings-email";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  return cronSecret && request.headers.get("Authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendWeeklySigningsSummary();
  return NextResponse.json(result);
}
