import { NextResponse } from "next/server";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { getFilteredReservas } from "@/lib/reservas-report";

export async function GET(request: Request) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { searchParams } = new URL(request.url);
  const rows = await getFilteredReservas(searchParams);
  return NextResponse.json(
    rows.map((row) => ({
      ...row,
      compradorCapturadoAt: authResult.role === "admin" ? row.compradorCapturadoAt : undefined,
      compradorGuardado: authResult.role === "admin" ? row.compradorGuardado : undefined,
    }))
  );
}
