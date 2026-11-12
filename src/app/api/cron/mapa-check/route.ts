import { NextResponse } from "next/server";
import { consultarArba, manzanasConCambios } from "@/lib/arba";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

// Lo dispara cron-job.org una vez por día. Avisa por mail si el mapa no carga o si
// el catastro de ARBA ya no coincide con la copia que usa el mapa (src/lib/arba-parcelas.json).
// Si ARBA no responde, avisa sólo los lunes para no mandar un mail por día mientras dure.
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const problema = await revisarMapa(new URL("/api/mapa", request.url));
  if (!problema) {
    return NextResponse.json({ ok: true });
  }

  await sendEmail({
    to: "juliankorn@gmail.com",
    subject: "⚠️ Mapa de lotes: hay que revisarlo",
    html: `<p>El chequeo diario del mapa de lotes (<a href="${new URL("/mapa", request.url)}">/mapa</a>) encontró algo:</p><p><strong>${problema}</strong></p>`,
  });

  return NextResponse.json({ ok: false, problema });
}

async function revisarMapa(url: URL): Promise<string | null> {
  let manzanas: string[];
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return `El mapa no carga: /api/mapa respondió ${response.status}${data?.error ? ` (${data.error})` : ""}.`;
    }
    if (!data?.geometria?.features?.length) {
      return "El mapa no muestra ninguna parcela dibujada.";
    }
    manzanas = [
      ...new Set<string>(
        data.lotes
          .map((lote: { manzana: string | null }) => lote.manzana?.trim())
          .filter((manzana: string | undefined) => !!manzana && /^\d+$/.test(manzana))
          .map((manzana: string) => String(Number(manzana)))
      ),
    ];
  } catch (error) {
    return `El mapa no carga: ${error instanceof Error ? error.message : error}`;
  }

  try {
    const cambios = manzanasConCambios(manzanas, await consultarArba(manzanas));
    if (cambios.length === 0) return null;
    return (
      `El catastro de ARBA cambió en las manzanas ${cambios.join(", ")} y el mapa todavía muestra la copia vieja. ` +
      `Para actualizarla: <code>pnpm run arba:actualizar ${cambios.join(" ")}</code>, revisar el cambio y hacer deploy.`
    );
  } catch (error) {
    const lunes =
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "America/Argentina/Buenos_Aires",
      }) === "Monday";
    if (!lunes) return null;
    return (
      `ARBA no responde (${error instanceof Error ? error.message : error}), así que no se puede ` +
      "comprobar si el catastro cambió. El mapa funciona igual con la copia guardada. Este aviso se repite los lunes."
    );
  }
}
