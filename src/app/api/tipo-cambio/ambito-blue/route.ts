import { NextResponse } from "next/server";
import { getAmbitoBlueAverage } from "@/lib/ambito-blue-rate";
import { isErrorResponse, requireApiAuth } from "@/lib/api-auth";

export async function GET() {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;
  if (!["admin", "comercial"].includes(authResult.role)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  return NextResponse.json(await getAmbitoBlueAverage());
}
