import { NextResponse } from "next/server";
import { and, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { parcelas, reservas } from "@/lib/schema";
import { activeReservaJoin, flattenParcelaReserva } from "@/lib/reservas";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import type { EstadoParcela } from "@/lib/schema";

export async function GET(request: Request) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado") as EstadoParcela | null;
  const search = searchParams.get("search");
  const manzana = searchParams.get("manzana");
  const superficieMin = searchParams.get("superficieMin");
  const superficieMax = searchParams.get("superficieMax");

  const conditions = [];

  if (estado) {
    conditions.push(eq(parcelas.estado, estado));
  }

  if (manzana) {
    conditions.push(ilike(parcelas.manzana, `%${manzana}%`));
  }

  if (superficieMin) {
    conditions.push(
      gte(sql`${parcelas.superficieM2}::numeric`, Number(superficieMin))
    );
  }

  if (superficieMax) {
    conditions.push(
      lte(sql`${parcelas.superficieM2}::numeric`, Number(superficieMax))
    );
  }

  if (search) {
    conditions.push(
      or(
        ilike(parcelas.manzana, `%${search}%`),
        ilike(parcelas.parcela, `%${search}%`),
        ilike(reservas.nombreComprador, `%${search}%`)
      )
    );
  }

  const rows = await db
    .select({ parcela: parcelas, reserva: reservas })
    .from(parcelas)
    .leftJoin(reservas, activeReservaJoin())
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(parcelas.numero);

  return NextResponse.json(
    rows.map((row) => flattenParcelaReserva(row.parcela, row.reserva))
  );
}
