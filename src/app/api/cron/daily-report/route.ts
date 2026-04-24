import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { buildDailyReportHtml } from "@/lib/email-template";
import { getParcelasSummary, getRecentReservations, getTodayLeads } from "@/lib/report-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [summary, reservations, todayLeads] = await Promise.all([
    getParcelasSummary(),
    getRecentReservations(),
    getTodayLeads(),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://barriostefani.vercel.app";
  const date = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const html = buildDailyReportHtml({ date, summary, appUrl, reservations, todayLeads });

  await sendEmail({
    to: "juliankorn@gmail.com",
    subject: `Reporte Diario — Barrio Stefani (${new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })})`,
    html,
  });

  return NextResponse.json({ ok: true, sentAt: new Date().toISOString() });
}
