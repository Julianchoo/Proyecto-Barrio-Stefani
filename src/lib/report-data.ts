import { db } from "@/lib/db";
import { parcelas, leads, reservas } from "@/lib/schema";
import type { Lead, ParcelaConReserva } from "@/lib/schema";
import { eq, gte, and, sql } from "drizzle-orm";
import { activeReservaJoin, flattenParcelaReserva } from "@/lib/reservas";

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

export async function getRecentReservations(): Promise<ParcelaConReserva[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateStr = sevenDaysAgo.toISOString().substring(0, 10);

  return db
    .select({ parcela: parcelas, reserva: reservas })
    .from(parcelas)
    .innerJoin(reservas, activeReservaJoin())
    .where(and(eq(parcelas.estado, "reservado"), gte(reservas.fechaReserva, dateStr)))
    .orderBy(reservas.fechaReserva)
    .then((rows) =>
      rows.map((row) => flattenParcelaReserva(row.parcela, row.reserva))
    );
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

export type { ParcelaConReserva as Parcela, Lead };
