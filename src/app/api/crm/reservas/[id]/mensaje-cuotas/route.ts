import { NextResponse } from "next/server";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import {
  formatCuentaMoney,
  getCuentaCorrienteDetailByReserva,
} from "@/lib/cuenta-corriente";

export async function POST(
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
  const blockedCuota = detail.cuotas.find(
    (cuota) =>
      cuota.estado === "pendiente_indice" &&
      cuota.fechaVencimiento <= new Date().toISOString().slice(0, 10)
  );
  if (blockedCuota) {
    return NextResponse.json(
      {
        error:
          "No se puede comunicar un monto definitivo: falta cargar el indice CAC",
      },
      { status: 409 }
    );
  }

  const comprador = detail.comprador ?? "cliente";
  const overdue = detail.totalVencido > 0;
  const proxima = detail.cuotas.find(
    (cuota) =>
      cuota.fechaVencimiento >= new Date().toISOString().slice(0, 10) &&
      !["pagada", "cancelada", "pendiente_indice"].includes(cuota.estado)
  );
  const proximaMonto = proxima
    ? formatCuentaMoney(proxima.saldo, detail.moneda)
    : null;

  const lines = overdue
    ? [
        `Hola ${comprador}, te escribimos por el estado de cuenta del lote ${detail.loteNumero}.`,
        `A la fecha registra un saldo vencido de ${formatCuentaMoney(detail.totalVencido, detail.moneda)}.`,
        `El saldo total pendiente es ${formatCuentaMoney(detail.saldoPendiente, detail.moneda)}.`,
        "Por favor avisanos cuando realices el pago para registrarlo en la cuenta corriente.",
      ]
    : [
        `Hola ${comprador}, te escribimos por el estado de cuenta del lote ${detail.loteNumero}.`,
        proxima
          ? `La proxima cuota vence el ${proxima.fechaVencimiento} por ${proximaMonto}.`
          : "No registra cuotas pendientes a la fecha.",
        `El saldo total pendiente es ${formatCuentaMoney(detail.saldoPendiente, detail.moneda)}.`,
      ];

  return NextResponse.json({ message: lines.join("\n") });
}
