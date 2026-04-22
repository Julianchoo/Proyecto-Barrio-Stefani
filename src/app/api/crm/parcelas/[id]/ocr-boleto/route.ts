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

Campos a extraer:

FECHA DEL DOCUMENTO:
- dia: número del día (solo el número, ej: "8")
- mes: nombre del mes en minúsculas en español (ej: "abril", "enero", "marzo")
- anio: año de 4 dígitos (ej: "2026")

COMPRADOR:
- nombreComprador: nombre completo del comprador (sin "Sr/Sra", solo el nombre)
- dniComprador: número de DNI del comprador (solo números, sin puntos)
- cuitComprador: CUIT del comprador si aparece (con guiones, ej: "20-12345678-9"), null si no está
- domicilioComprador: domicilio completo del comprador
- nacionalidad: nacionalidad del comprador (si no se menciona, usar null)
- fechaNacimiento: fecha de nacimiento si aparece, null si no está
- estadoCivil: estado civil si aparece (una de: "soltero/a", "casado/a", "divorciado/a", "viudo/a", "unión convivencial"), null si no está

CO-COMPRADOR (si hay más de un comprador en el documento):
- nombreCoComprador: nombre del co-comprador, null si no hay
- dniCoComprador: DNI del co-comprador, null si no hay
- cuitCoComprador: CUIT del co-comprador, null si no hay
- estadoCivilCoComprador: estado civil del co-comprador, null si no hay
- porcentajeCoComprador: porcentaje de compra del co-comprador (ej: "50"), null si no hay

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
{"dia":"8","mes":"abril","anio":"2026","nombreComprador":"Carlos A. Palacio","dniComprador":"31173551","cuitComprador":null,"domicilioComprador":"Coronel Escalada 10020, Cuartel V, Moreno","nacionalidad":null,"fechaNacimiento":null,"estadoCivil":null,"nombreCoComprador":null,"dniCoComprador":null,"cuitCoComprador":null,"estadoCivilCoComprador":null,"porcentajeCoComprador":null,"precioTotalPalabras":"VEINTIDOS MIL QUINIENTOS SETENTA Y DOS","precioTotalNum":"22572","anticipoPalabras":"CUATRO MIL QUINIENTAS","anticipoNum":"4500","saldoPalabras":"DIECIOCHO MIL SETENTA Y DOS","saldoNum":"18072","cantidadCuotas":"72","cuotaMensualPalabras":"DOSCIENTOS CINCUENTA Y UNO","cuotaMensual":"251"}`;

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
