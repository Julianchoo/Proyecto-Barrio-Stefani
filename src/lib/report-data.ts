import { db } from "@/lib/db";
import { parcelas, leads } from "@/lib/schema";
import type { Parcela, Lead } from "@/lib/schema";
import { eq, gte, and, sql } from "drizzle-orm";

export type ParcelasSummary = Record<string, number>;

export async function getParcelasSummary(): Promise<ParcelasSummary> {
  const rows = await db
    .select({
      estado: parcelas.estado,
      count: sql<number>`count(*)::int`,
    })
    .from(parcelas)
    .groupBy(parcelas.estado);

  return Object.fromEntries(rows.map((r) => [r.estado, r.count]));
}

export async function getRecentReservations(): Promise<Parcela[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateStr = sevenDaysAgo.toISOString().substring(0, 10);

  return db
    .select()
    .from(parcelas)
    .where(and(eq(parcelas.estado, "reservado"), gte(parcelas.fechaReserva, dateStr)))
    .orderBy(parcelas.fechaReserva);
}

export async function getTodayLeads(): Promise<Lead[]> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  return db
    .select()
    .from(leads)
    .where(gte(leads.createdAt, startOfToday))
    .orderBy(leads.createdAt);
}

export type { Parcela, Lead };
