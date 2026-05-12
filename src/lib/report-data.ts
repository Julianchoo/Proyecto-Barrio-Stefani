import { eq, gte, lte, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activeReservaJoin, flattenParcelaReserva } from "@/lib/reservas";
import { parcelas, leads, reservas } from "@/lib/schema";
import type { Lead, ParcelaConReserva } from "@/lib/schema";

export type ParcelasSummary = Record<string, number>;
export type SigningWeekRange = { start: string; end: string };

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
    .then((rows) => rows.map((row) => flattenParcelaReserva(row.parcela, row.reserva)));
}

function toDateKey(date: Date): string {
  return date.toISOString().substring(0, 10);
}

export function getNextSigningWeekRange(now = new Date()): SigningWeekRange {
  const currentWeek = getCurrentSigningWeekRange(now);
  const start = new Date(`${currentWeek.start}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + 7);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return { start: toDateKey(start), end: toDateKey(end) };
}

export function getCurrentSigningWeekRange(now = new Date()): SigningWeekRange {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const today = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = today.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - daysSinceMonday);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return { start: toDateKey(start), end: toDateKey(end) };
}

export async function getUpcomingSignings(
  range = getNextSigningWeekRange()
): Promise<ParcelaConReserva[]> {
  return db
    .select({ parcela: parcelas, reserva: reservas })
    .from(parcelas)
    .innerJoin(reservas, eq(reservas.parcelaId, parcelas.id))
    .where(
      and(
        eq(reservas.estado, "activa"),
        gte(reservas.fechaFirma, range.start),
        lte(reservas.fechaFirma, range.end)
      )
    )
    .orderBy(reservas.fechaFirma, parcelas.manzana, parcelas.numero)
    .then((rows) => rows.map((row) => flattenParcelaReserva(row.parcela, row.reserva)));
}

export async function getTodayLeads(): Promise<Lead[]> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  return db.select().from(leads).where(gte(leads.createdAt, startOfToday)).orderBy(leads.createdAt);
}

export type { ParcelaConReserva as Parcela, Lead };
