import { sendEmail } from "@/lib/email";
import { getNextSigningWeekRange, getUpcomingSignings } from "@/lib/report-data";
import { buildWeeklySigningsEmailHtml } from "@/lib/weekly-signings-email-template";

const RECIPIENTS = "juliankorn@gmail.com, hugo.guindani@gmail.com";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export async function sendWeeklySigningsSummary() {
  const range = getNextSigningWeekRange();
  const signings = await getUpcomingSignings(range);

  if (signings.length === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "No upcoming signings",
      range,
      count: 0,
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://barriostefani.vercel.app";
  const html = buildWeeklySigningsEmailHtml({ appUrl, range, signings });

  await sendEmail({
    to: RECIPIENTS,
    subject: `Firmas previstas Barrio Stefani (${formatDate(range.start)} al ${formatDate(range.end)})`,
    html,
  });

  return {
    ok: true,
    skipped: false,
    sentAt: new Date().toISOString(),
    range,
    count: signings.length,
  };
}
