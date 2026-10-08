import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { auditLog, leads, parcelas, reservas } from "@/lib/schema";

const PAGE_SIZE = 100;
const ENTIDADES = ["lote", "reserva", "lead"] as const;

function isDateKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: Request) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { searchParams } = new URL(request.url);
  const entidad = searchParams.get("entidad");
  const entidadId = Number(searchParams.get("entidadId"));
  const usuario = searchParams.get("usuario");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const conditions = [];
  if (entidad && (ENTIDADES as readonly string[]).includes(entidad)) {
    conditions.push(eq(auditLog.entidad, entidad as (typeof ENTIDADES)[number]));
  }
  if (Number.isInteger(entidadId) && entidadId > 0) conditions.push(eq(auditLog.entidadId, entidadId));
  if (usuario) conditions.push(eq(auditLog.usuario, usuario));
  if (isDateKey(desde)) conditions.push(gte(auditLog.createdAt, new Date(`${desde}T00:00:00`)));
  if (isDateKey(hasta)) {
    const end = new Date(`${hasta}T00:00:00`);
    end.setDate(end.getDate() + 1);
    conditions.push(lt(auditLog.createdAt, end));
  }

  const rows = await db
    .select()
    .from(auditLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(PAGE_SIZE + 1)
    .offset(offset);
  const page = rows.slice(0, PAGE_SIZE);

  // Nombres legibles para cada entidad (lote N, reserva #id del lote N, nombre del lead).
  const idsOf = (tipo: (typeof ENTIDADES)[number]) =>
    [...new Set(page.filter((row) => row.entidad === tipo).map((row) => row.entidadId))];
  const loteIds = idsOf("lote");
  const reservaIds = idsOf("reserva");
  const leadIds = idsOf("lead");
  const [loteRows, reservaRows, leadRows, usuarioRows] = await Promise.all([
    loteIds.length
      ? db.select({ id: parcelas.id, numero: parcelas.numero }).from(parcelas).where(inArray(parcelas.id, loteIds))
      : [],
    reservaIds.length
      ? db
          .select({ id: reservas.id, loteNumero: parcelas.numero, comprador: reservas.nombreComprador })
          .from(reservas)
          .innerJoin(parcelas, eq(reservas.parcelaId, parcelas.id))
          .where(inArray(reservas.id, reservaIds))
      : [],
    leadIds.length
      ? db.select({ id: leads.id, nombre: leads.nombre }).from(leads).where(inArray(leads.id, leadIds))
      : [],
    db.selectDistinct({ usuario: auditLog.usuario }).from(auditLog).orderBy(auditLog.usuario),
  ]);
  const lotes = new Map(loteRows.map((row) => [row.id, `Lote ${row.numero}`]));
  const reservasMap = new Map(
    reservaRows.map((row) => [
      row.id,
      `Reserva #${row.id} · Lote ${row.loteNumero}${row.comprador ? ` · ${row.comprador}` : ""}`,
    ])
  );
  const leadsMap = new Map(leadRows.map((row) => [row.id, row.nombre]));

  return NextResponse.json({
    rows: page.map((row) => {
      const nombreBorrado = row.cambios.nombre?.antes;
      const label =
        row.entidad === "lote"
          ? lotes.get(row.entidadId)
          : row.entidad === "reserva"
            ? reservasMap.get(row.entidadId)
            : leadsMap.get(row.entidadId) ?? (typeof nombreBorrado === "string" ? nombreBorrado : undefined);
      return { ...row, label: label ?? `${row.entidad} #${row.entidadId}` };
    }),
    hasMore: rows.length > PAGE_SIZE,
    usuarios: usuarioRows.map((row) => row.usuario),
  });
}
