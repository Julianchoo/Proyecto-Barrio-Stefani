import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { getNextSigningWeekRange, getUpcomingSignings } from "@/lib/report-data";
import { buildWeeklySigningsEmailHtml } from "@/lib/weekly-signings-email-template";

export const runtime = "nodejs";

const RECIPIENTS = "juliankorn@gmail.com, hugo.guindani@gmail.com";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  return cronSecret && request.headers.get("Authorization") === `Bearer ${cronSecret}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = getNextSigningWeekRange();
  const signings = await getUpcomingSignings(range);

  if (signings.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "No upcoming signings",
      range,
      count: 0,
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://barriostefani.vercel.app";
  const html = buildWeeklySigningsEmailHtml({ appUrl, range, signings });

  await sendEmail({
    to: RECIPIENTS,
    subject: `Firmas previstas Barrio Stefani (${formatDate(range.start)} al ${formatDate(range.end)})`,
    html,
  });

  return NextResponse.json({
    ok: true,
    sentAt: new Date().toISOString(),
    range,
    count: signings.length,
  });
}
