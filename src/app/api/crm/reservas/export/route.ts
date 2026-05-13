import { NextResponse } from "next/server";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { getFilteredReservas } from "@/lib/reservas-report";
import { buildReservasExportExcel } from "@/lib/weekly-signings-excel";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { searchParams } = new URL(request.url);
  const reservas = await getFilteredReservas(searchParams);
  const excel = buildReservasExportExcel(reservas);
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(excel), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Reservas_Barrio_Stefani_${today}.xlsx"`,
    },
  });
}
