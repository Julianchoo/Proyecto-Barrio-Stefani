import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { createContratoForReserva } from "@/lib/cuenta-corriente";
import { db } from "@/lib/db";
import { reservas } from "@/lib/schema";

const createSchema = z.object({
  modalidad: z.enum(["usd_fijo", "pesos_cac"]),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  fechaPrimerVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cantidadCuotas: z.number().int().positive().nullable().optional(),
  cuotaBase: z.number().positive().nullable().optional(),
  saldoInicial: z.number().positive().nullable().optional(),
  tipoCambioBna: z.number().positive().nullable().optional(),
  diaVencimiento: z.number().int().min(1).max(31).nullable().optional(),
  periodoBaseCac: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  observaciones: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const reservaId = Number(id);
  if (!Number.isFinite(reservaId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const [reserva] = await db.select().from(reservas).where(eq(reservas.id, reservaId));
  if (!reserva) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }
  if (reserva.formaPago === "contado") {
    return NextResponse.json(
      { error: "Las reservas de contado no generan cuenta corriente" },
      { status: 409 }
    );
  }

  const result = await createContratoForReserva(reservaId, parsed.data, authResult.email);
  if (result.kind === "not-realizada") {
    return NextResponse.json(
      { error: "La cuenta corriente nace desde una reserva realizada" },
      { status: 409 }
    );
  }
  if (result.kind === "exists") {
    return NextResponse.json(
      { error: "La reserva ya tiene cuenta corriente", contratoId: result.contratoId },
      { status: 409 }
    );
  }
  if (result.kind === "missing-data") {
    return NextResponse.json(
      { error: "Faltan datos para generar el plan de cuotas" },
      { status: 400 }
    );
  }
  if (result.kind === "missing-exchange-rate") {
    return NextResponse.json(
      { error: "Ingresá el tipo de cambio vendedor BNA para generar cuotas en pesos + CAC" },
      { status: 400 }
    );
  }
  if (result.kind === "missing-base-cac") {
    return NextResponse.json(
      { error: "Carga el indice CAC del periodo base antes de crear la cuenta corriente" },
      { status: 400 }
    );
  }
  if (result.kind === "not-found") {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ contratoId: result.contratoId }, { status: 201 });
}
