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

  const prompt = `Analiza esta imagen de una reserva de compra de lote inmobiliario y extrae los siguientes datos. Responde UNICAMENTE con un objeto JSON valido, sin texto adicional, sin markdown, sin bloques de codigo.

DATOS DEL COMPRADOR Y RESERVA:
- nombreComprador: nombre completo del comprador (sin "Sr/Sra", solo el nombre)
- dniCuit: numero de DNI del comprador (solo numeros, sin puntos)
- telefono: telefono del comprador (si aparece)
- emailComprador: email del comprador (si aparece)
- domicilioComprador: domicilio del comprador
- nacionalidad: nacionalidad del comprador (si aparece)
- fechaNacimiento: fecha de nacimiento del comprador en formato YYYY-MM-DD (si aparece)
- estadoCivil: estado civil si aparece (una de: "soltero/a", "casado/a", "divorciado/a", "viudo/a", "union convivencial")
- cuitComprador: CUIT del comprador si aparece (con guiones, ej: "20-12345678-9")
- nombreCoComprador: nombre del co-comprador, null si no hay
- dniCoComprador: DNI del co-comprador, null si no hay
- cuitCoComprador: CUIT del co-comprador, null si no hay
- estadoCivilCoComprador: estado civil del co-comprador, null si no hay
- porcentajeCoComprador: porcentaje de compra del co-comprador (ej: "50"), null si no hay
- fechaReserva: fecha del documento en formato YYYY-MM-DD (buscar al inicio del documento)
- fechaVencimiento: fecha de vencimiento de la reserva en formato YYYY-MM-DD (si aparece)
- formaPago: forma de pago indicada (ej: "contado", "financiado", "cuotas", etc.)
- nombreCorredor: nombre del corredor/intermediario inmobiliario (si aparece)
- observaciones: cualquier observacion relevante que no encaje en los campos anteriores

PRECIO (buscar en la seccion "PRECIO Y FORMA DE PAGO" o similar):
- precioTotalPalabras: precio total en letras EN MAYUSCULAS (ej: "VEINTIDOS MIL QUINIENTOS SETENTA Y DOS")
- precioTotalNum: precio total en numero (solo el numero sin simbolos, ej: "22572")
- anticipoPalabras: anticipo en letras EN MAYUSCULAS (ej: "CUATRO MIL QUINIENTAS")
- anticipoNum: monto del anticipo en numero (ej: "4500")
- saldoPalabras: saldo restante en letras EN MAYUSCULAS (ej: "DIECIOCHO MIL SETENTA Y DOS")
- saldoNum: saldo restante en numero (ej: "18072")
- cantidadCuotas: cantidad de cuotas (solo el numero, ej: "72")
- cuotaMensualPalabras: valor de la cuota mensual en letras EN MAYUSCULAS (ej: "DOSCIENTOS CINCUENTA Y UNO")
- cuotaMensual: valor de la cuota mensual en numero (ej: "251")

Si un campo no esta presente o no es legible, usa null. No inventes datos.

Ejemplo de respuesta esperada:
{"nombreComprador":"Carlos A. Palacio","dniCuit":"31173551","telefono":null,"emailComprador":null,"domicilioComprador":"Coronel Escalada 10020, Cuartel V, Moreno","nacionalidad":null,"fechaNacimiento":null,"estadoCivil":null,"cuitComprador":null,"nombreCoComprador":null,"dniCoComprador":null,"cuitCoComprador":null,"estadoCivilCoComprador":null,"porcentajeCoComprador":null,"fechaReserva":"2026-04-08","fechaVencimiento":null,"formaPago":"financiado","nombreCorredor":"Victoria Anapira","observaciones":null,"precioTotalPalabras":"VEINTIDOS MIL QUINIENTOS SETENTA Y DOS","precioTotalNum":"22572","anticipoPalabras":"CUATRO MIL QUINIENTAS","anticipoNum":"4500","saldoPalabras":"DIECIOCHO MIL SETENTA Y DOS","saldoNum":"18072","cantidadCuotas":"72","cuotaMensualPalabras":"DOSCIENTOS CINCUENTA Y UNO","cuotaMensual":"251"}`;

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
