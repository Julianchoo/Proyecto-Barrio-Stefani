import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { leads, reservas } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { crmTransaction } from "@/lib/crm-transaction";
import { requireApiAdmin, requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { z } from "zod";
import { validationMessage } from "@/lib/validation-message";

const updateSchema = z.object({
  estado: z.enum(["nuevo", "asignado", "a_contactar", "contactado", "sin_respuesta", "closed_won", "closed_lost"]).optional(),
  notas: z.string().nullable().optional(),
  asignadoA: z.string().nullable().optional(),
  nombre: z.string().min(1).optional(),
  telefono: z.string().min(1).optional(),
  email: z.string().email().optional(),
  dniCuit: z.string().nullable().optional(),
  domicilio: z.string().nullable().optional(),
  nacionalidad: z.string().nullable().optional(),
  fechaNacimiento: z.string().nullable().optional(),
  estadoCivil: z.string().nullable().optional(),
  cuitComprador: z.string().nullable().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const leadId = parseInt(id);
  if (isNaN(leadId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    // Only admins can assign leads
    if ("asignadoA" in data && authResult.role !== "admin") {
      return NextResponse.json({ error: "Solo un administrador puede asignar leads" }, { status: 403 });
    }

    return await crmTransaction(async (tx) => {
      const [current] = await tx.select().from(leads).where(eq(leads.id, leadId));
      if (!current) {
        return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
      }
      // Comercials can only edit their own leads
      if (authResult.role !== "admin" && current.asignadoA !== authResult.id) {
        return NextResponse.json({ error: "Este lead no está asignado a vos: solo podés editar tus propios leads" }, { status: 403 });
      }
      if (authResult.role !== "admin") {
        const [realizada] = await tx
          .select({ id: reservas.id })
          .from(reservas)
          .where(and(eq(reservas.leadId, leadId), eq(reservas.estado, "realizada")))
          .limit(1);
        if (realizada)
          return NextResponse.json(
            {
              error: `Este lead tiene la reserva #${realizada.id} realizada (venta): solo un administrador puede modificarlo. Pedile el cambio a un admin`,
            },
            { status: 403 }
          );
      }

      // Asignar un lead nuevo lo pasa a "asignado"; desasignarlo lo devuelve a "nuevo".
      // Solo desde esos estados, para no pisar el avance de un lead ya trabajado.
      if ("asignadoA" in data && !data.estado) {
        if (data.asignadoA && current.estado === "nuevo") data.estado = "asignado";
        if (!data.asignadoA && current.estado === "asignado") data.estado = "nuevo";
      }

      const [updated] = await tx.update(leads).set(data).where(eq(leads.id, leadId)).returning();

      if (!updated) {
        return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
      }
      await logAudit(tx, {
        entidad: "lead",
        entidadId: leadId,
        usuario: authResult.email,
        antes: current,
        despues: updated,
      });

      return NextResponse.json(updated);
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: validationMessage(error.issues), details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const leadId = parseInt(id);
  if (isNaN(leadId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  return crmTransaction(async (tx) => {
    const [linked] = await tx
      .select({ id: reservas.id })
      .from(reservas)
      .where(eq(reservas.leadId, leadId))
      .limit(1);
    if (linked)
      return NextResponse.json(
        {
          error:
            "No se puede eliminar un lead vinculado a una reserva; se debe conservar su historial",
        },
        { status: 409 }
      );
    const [deleted] = await tx.delete(leads).where(eq(leads.id, leadId)).returning();

    if (!deleted) {
      return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    }
    await logAudit(tx, {
      entidad: "lead",
      entidadId: leadId,
      usuario: authResult.email,
      antes: deleted,
      despues: null,
    });

    return NextResponse.json({ ok: true });
  });
}
