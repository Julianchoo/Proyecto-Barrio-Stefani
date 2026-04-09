import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parcelas } from "@/lib/schema";
import { eq, ilike, or, and, gte, lte, sql } from "drizzle-orm";
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
        ilike(parcelas.nombreComprador, `%${search}%`)
      )
    );
  }

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(parcelas)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(parcelas.numero)
      : await db.select().from(parcelas).orderBy(parcelas.numero);

  return NextResponse.json(rows);
}
