import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const formData = await req.formData();
  const file = formData.get("image");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mimeType = file.type || "image/jpeg";
  const dataUri = `data:${mimeType};base64,${base64}`;

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "MISTRAL_API_KEY not configured" },
      { status: 500 }
    );
  }

  const prompt = `Analizá esta imagen de una reserva de compra de lote inmobiliario y extraé los siguientes datos. Respondé ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin bloques de código.

DATOS DEL COMPRADOR Y RESERVA:
- nombreComprador: nombre completo del comprador (sin "Sr/Sra", solo el nombre)
- dniCuit: número de DNI o CUIT del comprador (solo números)
- telefono: teléfono del comprador (si aparece)
- domicilioComprador: domicilio del comprador
- fechaReserva: fecha del documento en formato YYYY-MM-DD (buscar al inicio del documento)
- fechaVencimiento: fecha de vencimiento de la reserva en formato YYYY-MM-DD (si aparece)
- formaPago: forma de pago indicada (ej: "contado", "financiado", "cuotas", etc.)
- nombreCorredor: nombre del corredor/intermediario inmobiliario (si aparece)
- observaciones: cualquier observación relevante que no encaje en los campos anteriores

PRECIO (buscar en la sección "PRECIO Y FORMA DE PAGO" o similar):
- precioTotalPalabras: precio total en letras EN MAYÚSCULAS (ej: "VEINTIDOS MIL QUINIENTOS SETENTA Y DOS")
- precioTotalNum: precio total en número (solo el número sin símbolos, ej: "22572")
- anticipoPalabras: anticipo en letras EN MAYÚSCULAS (ej: "CUATRO MIL QUINIENTAS")
- anticipoNum: monto del anticipo en número (ej: "4500")
- saldoPalabras: saldo restante en letras EN MAYÚSCULAS (ej: "DIECIOCHO MIL SETENTA Y DOS")
- saldoNum: saldo restante en número (ej: "18072")
- cantidadCuotas: cantidad de cuotas (solo el número, ej: "72")
- cuotaMensualPalabras: valor de la cuota mensual en letras EN MAYÚSCULAS (ej: "DOSCIENTOS CINCUENTA Y UNO")
- cuotaMensual: valor de la cuota mensual en número (ej: "251")

Si un campo no está presente o no es legible, usá null. No inventes datos.

Ejemplo de respuesta esperada:
{"nombreComprador":"Carlos A. Palacio","dniCuit":"31173551","telefono":null,"domicilioComprador":"Coronel Escalada 10020, Cuartel V, Moreno","fechaReserva":"2026-04-08","fechaVencimiento":null,"formaPago":"financiado","nombreCorredor":"Victoria Anapira","observaciones":null,"precioTotalPalabras":"VEINTIDOS MIL QUINIENTOS SETENTA Y DOS","precioTotalNum":"22572","anticipoPalabras":"CUATRO MIL QUINIENTAS","anticipoNum":"4500","saldoPalabras":"DIECIOCHO MIL SETENTA Y DOS","saldoNum":"18072","cantidadCuotas":"72","cuotaMensualPalabras":"DOSCIENTOS CINCUENTA Y UNO","cuotaMensual":"251"}`;

  const mistralResponse = await fetch(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: dataUri },
            ],
          },
        ],
        temperature: 0,
      }),
    }
  );

  if (!mistralResponse.ok) {
    const errorText = await mistralResponse.text();
    console.error("Mistral API error:", errorText);
    return NextResponse.json(
      { error: "Error calling Mistral API" },
      { status: 500 }
    );
  }

  const mistralData = await mistralResponse.json();
  const content = mistralData.choices?.[0]?.message?.content ?? "";

  let extracted: Record<string, string | null> = {};
  try {
    // Strip any accidental markdown fences
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    extracted = JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse Mistral response:", content);
    return NextResponse.json(
      { error: "Could not parse OCR response", raw: content },
      { status: 422 }
    );
  }

  return NextResponse.json(extracted);
}
