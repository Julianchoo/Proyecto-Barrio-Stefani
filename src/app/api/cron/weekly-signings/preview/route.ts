import {
  getCurrentSigningWeekRange,
  getNextSigningWeekRange,
  getUpcomingSignings,
} from "@/lib/report-data";
import { buildWeeklySigningsEmailHtml } from "@/lib/weekly-signings-email-template";

export const runtime = "nodejs";

export async function GET() {
  const currentWeekRange = getCurrentSigningWeekRange();
  const nextWeekRange = getNextSigningWeekRange();
  const [currentWeekSignings, nextWeekSignings] = await Promise.all([
    getUpcomingSignings(currentWeekRange),
    getUpcomingSignings(nextWeekRange),
  ]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const html = buildWeeklySigningsEmailHtml({
    appUrl,
    sections: [
      { title: "Firmas de esta semana", range: currentWeekRange, signings: currentWeekSignings },
      { title: "Firmas de la proxima semana", range: nextWeekRange, signings: nextWeekSignings },
    ],
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
