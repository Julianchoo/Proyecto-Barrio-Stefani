import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  calculateInstallment,
  getMinimumAnticipoUsd,
  PLAZO_MAX_PUBLICO,
  TASA_PUBLICA,
} from "@/lib/financiacion";
import { leads, parcelas, user, type SimulacionLead } from "@/lib/schema";

const createLeadSchema = z.object({
  nombre: z.string().min(2).max(100),
  telefono: z.string().min(6).max(30),
  email: z.string().email(),
  mensaje: z.string().max(1000).optional(),
  // Consulta por un lote desde el mapa público (opcional).
  parcelaId: z.number().int().positive().optional(),
  anticipo: z.number().positive().optional(),
  plazo: z.number().int().min(1).max(PLAZO_MAX_PUBLICO).optional(),
  // Id del comercial que compartió el link del mapa (?ref=...).
  ref: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = createLeadSchema.parse(body);

    // La cuota se recalcula acá con el precio de la base: no se confía en el navegador.
    let simulacion: SimulacionLead | null = null;
    if (data.parcelaId) {
      const [parcela] = await db
        .select({ precioBase: parcelas.precioBase })
        .from(parcelas)
        .where(eq(parcelas.id, data.parcelaId));
      if (!parcela) {
        return NextResponse.json({ error: "Lote inexistente" }, { status: 400 });
      }
      const precio = Number(parcela.precioBase);
      if (precio > 0 && data.anticipo && data.plazo) {
        const minimo = getMinimumAnticipoUsd(precio);
        if (data.anticipo < minimo || data.anticipo > precio) {
          return NextResponse.json(
            { error: `El anticipo tiene que estar entre USD ${minimo} y USD ${precio}` },
            { status: 400 }
          );
        }
        simulacion = {
          precio,
          anticipo: data.anticipo,
          plazo: data.plazo,
          tasa: TASA_PUBLICA,
          cuotaMensual: calculateInstallment(precio - data.anticipo, TASA_PUBLICA, data.plazo),
        };
      }
    }

    // Un ref que no corresponde a un usuario se ignora: el lead entra como web, sin asignar.
    const [referente] = data.ref
      ? await db.select({ id: user.id }).from(user).where(eq(user.id, data.ref))
      : [];

    const inserted = await db
      .insert(leads)
      .values({
        nombre: data.nombre,
        telefono: data.telefono,
        email: data.email,
        mensaje: data.mensaje ?? null,
        estado: referente ? "asignado" : "nuevo",
        parcelaId: data.parcelaId ?? null,
        simulacion,
        origen: referente ? "link_comercial" : "web",
        referidoPor: referente?.id ?? null,
        asignadoA: referente?.id ?? null,
      })
      .returning();
    if (inserted[0]) {
      await logAudit(db, {
        entidad: "lead",
        entidadId: inserted[0].id,
        usuario: "web",
        antes: null,
        despues: inserted[0],
      });
    }

    return NextResponse.json({ id: inserted[0]?.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
