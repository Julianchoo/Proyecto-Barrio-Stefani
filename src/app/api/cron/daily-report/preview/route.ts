import { buildDailyReportHtml } from "@/lib/email-template";
import { getParcelasSummary, getRecentReservations, getTodayLeads } from "@/lib/report-data";

export const runtime = "nodejs";

export async function GET() {
  const [summary, reservations, todayLeads] = await Promise.all([
    getParcelasSummary(),
    getRecentReservations(),
    getTodayLeads(),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const date = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const html = buildDailyReportHtml({ date, summary, appUrl, reservations, todayLeads });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
