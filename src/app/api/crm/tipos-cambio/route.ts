import { NextResponse } from "next/server";
import { z } from "zod";
import { isErrorResponse, requireApiAdmin } from "@/lib/api-auth";
import { listTiposCambioBna, saveTipoCambioBna } from "@/lib/tipos-cambio";

const inputSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valor: z.number().positive(),
  fuente: z.string().nullable().optional(),
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
  });
  return NextResponse.json(row, { status: 201 });
}
