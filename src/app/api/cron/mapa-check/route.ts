import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

// Lo dispara cron-job.org una vez por día. Llama a /api/mapa y, si falla o está
// usando la copia local de las parcelas porque ARBA no responde, avisa por mail.
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL("/api/mapa", request.url);
  let problema: string | null = null;
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      problema = `/api/mapa respondió ${response.status}${data?.error ? `: ${data.error}` : ""}.`;
    } else if (!data?.geometria?.features?.length) {
      problema = "/api/mapa no devolvió ninguna parcela dibujada.";
    } else if (data.fuente !== "arba") {
      problema =
        "ARBA no responde: el mapa está funcionando con la copia local de las parcelas. " +
        "Revisá si ARBA volvió o si cambió algo en su servicio (certificado, URL, formato).";
    }
  } catch (error) {
    problema = `No se pudo consultar /api/mapa: ${error instanceof Error ? error.message : error}`;
  }

  if (!problema) {
    return NextResponse.json({ ok: true });
  }

  await sendEmail({
    to: "juliankorn@gmail.com",
    subject: "⚠️ Mapa de lotes: hay que revisarlo",
    html: `<p>El chequeo diario del mapa de lotes (<a href="${new URL("/mapa", request.url)}">/mapa</a>) encontró un problema:</p><p><strong>${problema}</strong></p><p>Los detalles están en los logs de Vercel de <code>/api/mapa</code>.</p>`,
  });

  return NextResponse.json({ ok: false, problema });
}
