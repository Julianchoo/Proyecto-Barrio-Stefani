import { NextResponse } from "next/server";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { sendWeeklySigningsSummary } from "@/lib/weekly-signings-email";

export const runtime = "nodejs";

export async function POST() {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const result = await sendWeeklySigningsSummary();
  return NextResponse.json(result);
}
