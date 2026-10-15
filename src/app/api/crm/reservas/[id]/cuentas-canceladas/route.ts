import { NextResponse } from "next/server";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { cancelarCuentaCorriente, listCuentasCanceladas } from "@/lib/cuenta-corriente";

async function reservaIdFrom(params: Promise<{ id: string }>) {
  const reservaId = Number((await params).id);
  return Number.isFinite(reservaId) ? reservaId : null;
}

// Historial de cuentas corrientes canceladas de la reserva.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;
  const reservaId = await reservaIdFrom(params);
  if (reservaId === null) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

  return NextResponse.json(await listCuentasCanceladas(reservaId));
}

// Cancela la cuenta corriente vigente de la reserva (pasa al historial).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;
  const reservaId = await reservaIdFrom(params);
  if (reservaId === null) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

  const cancelado = await cancelarCuentaCorriente(reservaId, authResult.email);
  if (!cancelado) {
    return NextResponse.json(
      { error: "La reserva no tiene cuenta corriente vigente" },
      { status: 404 }
    );
  }
  return NextResponse.json(cancelado);
}
