import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { crmTransaction } from "@/lib/crm-transaction";
import { compradorGuardado } from "@/lib/reservas";
import { reservas } from "@/lib/schema";

const text = z.string().trim().max(500).nullable();
const schema = z
  .object({
    confirmar: z.literal(true),
    motivo: z.string().trim().min(5).max(1000),
    version: z.iso.datetime(),
    comprador: z
      .object({
        nombreComprador: text,
        dniCuit: text,
        telefono: text,
        emailComprador: z.union([z.email(), z.literal("")]).nullable(),
        domicilioComprador: text,
        nacionalidad: text,
        fechaNacimiento: z.iso.date().nullable(),
        estadoCivil: text,
        cuitComprador: text,
      })
      .strict(),
  })
  .strict();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin();
  if (isErrorResponse(auth)) return auth;
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Reserva inválida" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisá los datos, el motivo y la confirmación" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  try {
    return await crmTransaction(async (tx) => {
      const [current] = await tx.select().from(reservas).where(eq(reservas.id, id));
      if (!current) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
      if (current.estado !== "realizada") {
        return NextResponse.json(
          { error: "La corrección histórica requiere una reserva realizada" },
          { status: 409 }
        );
      }
      if (current.updatedAt.getTime() !== new Date(data.version).getTime()) {
        return NextResponse.json(
          { error: "La reserva cambió. Recargá la ficha antes de corregirla" },
          { status: 409 }
        );
      }
      const before = compradorGuardado(current);
      if (
        Object.keys(before).every(
          (field) =>
            before[field as keyof typeof before] === data.comprador[field as keyof typeof before]
        )
      ) {
        return NextResponse.json({ error: "No hay cambios en la copia" }, { status: 400 });
      }
      const [after] = await tx
        .update(reservas)
        .set({
          ...data.comprador,
          modificadoPor: auth.email,
          updatedAt: new Date(),
        })
        .where(eq(reservas.id, id))
        .returning();
      await logAudit(tx, {
        entidad: "reserva",
        entidadId: id,
        usuario: auth.email,
        antes: current,
        despues: { ...after, motivoCorreccionCopia: data.motivo },
      });
      return NextResponse.json({ ok: true });
    });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la corrección" }, { status: 500 });
  }
}
