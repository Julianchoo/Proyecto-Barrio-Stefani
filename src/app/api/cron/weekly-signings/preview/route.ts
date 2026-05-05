import { getNextSigningWeekRange, getUpcomingSignings } from "@/lib/report-data";
import { buildWeeklySigningsEmailHtml } from "@/lib/weekly-signings-email-template";

export const runtime = "nodejs";

export async function GET() {
  const range = getNextSigningWeekRange();
  const signings = await getUpcomingSignings(range);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const html = buildWeeklySigningsEmailHtml({ appUrl, range, signings });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
