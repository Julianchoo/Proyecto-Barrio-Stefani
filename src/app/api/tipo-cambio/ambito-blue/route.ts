import { NextResponse } from "next/server";
import { getAmbitoBlueAverage, getAmbitoBlueAverageOn } from "@/lib/ambito-blue-rate";
import { isErrorResponse, requireApiAuth } from "@/lib/api-auth";

export async function GET(request: Request) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;
  if (!["admin", "comercial", "socio"].includes(authResult.role)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  const fecha = new URL(request.url).searchParams.get("fecha");
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Fecha inválida (yyyy-mm-dd)" }, { status: 400 });
  }
  return NextResponse.json(
    await (fecha ? getAmbitoBlueAverageOn(fecha) : getAmbitoBlueAverage())
  );
}
