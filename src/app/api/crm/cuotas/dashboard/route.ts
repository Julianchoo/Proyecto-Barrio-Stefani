import { NextResponse } from "next/server";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { getCuotasDashboard } from "@/lib/cuenta-corriente";

export async function GET() {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  return NextResponse.json(await getCuotasDashboard());
}
