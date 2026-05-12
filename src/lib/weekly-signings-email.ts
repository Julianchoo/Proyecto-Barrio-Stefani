import { sendEmail } from "@/lib/email";
import {
  getCurrentSigningWeekRange,
  getNextSigningWeekRange,
  getUpcomingSignings,
} from "@/lib/report-data";
import { buildWeeklySigningsEmailHtml } from "@/lib/weekly-signings-email-template";

const RECIPIENTS = "juliankorn@gmail.com, hugo.guindani@gmail.com";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export async function sendWeeklySigningsSummary() {
  const currentWeekRange = getCurrentSigningWeekRange();
  const nextWeekRange = getNextSigningWeekRange();
  const [currentWeekSignings, nextWeekSignings] = await Promise.all([
    getUpcomingSignings(currentWeekRange),
    getUpcomingSignings(nextWeekRange),
  ]);
  const count = currentWeekSignings.length + nextWeekSignings.length;

  if (count === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "No upcoming signings",
      currentWeekRange,
      nextWeekRange,
      count: 0,
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://barriostefani.vercel.app";
  const html = buildWeeklySigningsEmailHtml({
    appUrl,
    sections: [
      { title: "Firmas de esta semana", range: currentWeekRange, signings: currentWeekSignings },
      { title: "Firmas de la proxima semana", range: nextWeekRange, signings: nextWeekSignings },
    ],
  });

  await sendEmail({
    to: RECIPIENTS,
    subject: `Firmas previstas Barrio Stefani (${formatDate(currentWeekRange.start)} al ${formatDate(nextWeekRange.end)})`,
    html,
  });

  return {
    ok: true,
    skipped: false,
    sentAt: new Date().toISOString(),
    currentWeekRange,
    nextWeekRange,
    count,
  };
}
