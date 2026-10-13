import { NextResponse } from "next/server";
import { z } from "zod";
import { isErrorResponse, requireApiAdmin } from "@/lib/api-auth";
import { listTiposCambioBna, saveTipoCambioBna } from "@/lib/tipos-cambio";

const inputSchema = z.object({
  fecha: z.iso.date(),
  valor: z
    .number()
    .positive()
    .refine(
      (value) => Math.round(value * 100) > 0,
      "La cotización debe ser positiva al redondear a centavos"
    ),
  fuente: z.string().nullable().optional(),
  confirmarImpacto: z.string().optional(),
});

export async function GET() {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;
  return NextResponse.json(await listTiposCambioBna());
}

export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const body = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Fecha o cotizacion invalida", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const row = await saveTipoCambioBna({
    fecha: parsed.data.fecha,
    valor: parsed.data.valor,
    fuente: parsed.data.fuente ?? null,
    creadoPor: authResult.email,
    confirmarImpacto: parsed.data.confirmarImpacto,
  });
  if (row.kind === "confirmation-required")
    return NextResponse.json(
      {
        error: "Esta cotización afecta importes existentes. Confirmá el cambio para continuar.",
        impact: row.impact,
        confirmarImpacto: row.confirmation,
      },
      { status: 409 }
    );
  return NextResponse.json(row.row, { status: 201 });
}
