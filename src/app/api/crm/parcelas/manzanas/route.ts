import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parcelas } from "@/lib/schema";
import { isNotNull, asc } from "drizzle-orm";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";

export async function GET() {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const rows = await db
    .selectDistinct({ manzana: parcelas.manzana })
    .from(parcelas)
    .where(isNotNull(parcelas.manzana))
    .orderBy(asc(parcelas.manzana));

  const values = rows
    .map((r) => r.manzana)
    .filter((m): m is string => m !== null);

  return NextResponse.json(values);
}
