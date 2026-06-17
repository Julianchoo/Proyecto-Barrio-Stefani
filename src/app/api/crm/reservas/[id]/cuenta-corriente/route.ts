import { NextResponse } from "next/server";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { getCuentaCorrienteDetailByReserva } from "@/lib/cuenta-corriente";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const reservaId = Number(id);
  if (!Number.isFinite(reservaId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const detail = await getCuentaCorrienteDetailByReserva(reservaId);
  if (!detail) {
    return NextResponse.json(
      { error: "Cuenta corriente no encontrada" },
      { status: 404 }
    );
  }

  return NextResponse.json(detail);
}
