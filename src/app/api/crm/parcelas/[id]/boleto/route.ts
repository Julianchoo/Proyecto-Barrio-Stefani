import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, parcelas, reservas } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { z } from "zod";
import { activeReservaJoin, flattenParcelaReserva } from "@/lib/reservas";
import path from "path";
import fs from "fs";
const PizZip = require("pizzip"); // eslint-disable-line @typescript-eslint/no-require-imports
const Docxtemplater = require("docxtemplater"); // eslint-disable-line @typescript-eslint/no-require-imports

const boletoSchema = z.object({
  // Fecha del boleto
  dia: z.string().min(1),
  mes: z.string().min(1),
  anio: z.string().min(1),
  // Datos del comprador (editables en el formulario)
  nombreComprador: z.string().optional().default(""),
  dniComprador: z.string().optional().default(""),
  // Datos adicionales del comprador (no guardados en DB)
  nacionalidad: z.string().min(1),
  fechaNacimiento: z.string().min(1),
  estadoCivil: z.string().min(1),
  cuitComprador: z.string().min(1),
  domicilioComprador: z.string().min(1),
  // Datos del inmueble (opcionales — se rellenan desde la DB, pero el usuario puede sobreescribir)
  calleInmueble: z.string().optional().default(""),
  limites: z.string().optional().default(""),
  tituloPlano: z.string().optional().default("Título"),
  medidas: z.string().optional().default(""),
  // Precio (puede sobreescribirse)
  precioTotalPalabras: z.string().optional().default(""),
  precioTotalNum: z.string().optional().default(""),
  anticipoPalabras: z.string().optional().default(""),
  anticipoNum: z.string().optional().default(""),
  saldoPalabras: z.string().optional().default(""),
  saldoNum: z.string().optional().default(""),
  cantidadCuotas: z.string().optional().default(""),
  cuotaMensualPalabras: z.string().optional().default(""),
  cuotaMensual: z.string().optional().default(""),
  // Tipo de pago
  tipoPago: z.enum(["contado", "financiado"]).default("financiado"),
  // Entrega
  entregaCuota: z.boolean().optional().default(false),
  numeroCuotaEntrega: z.string().optional().default(""),
  // Apoderado vendedora (opcional)
  hasApoderado: z.boolean().optional().default(false),
  nombreApoderado: z.string().optional().default(""),
  dniApoderado: z.string().optional().default(""),
  // Co-comprador (opcional)
  hasCoComprador: z.boolean().optional().default(false),
  nombreCoComprador: z.string().optional().default(""),
  dniCoComprador: z.string().optional().default(""),
  cuitCoComprador: z.string().optional().default(""),
  estadoCivilCoComprador: z.string().optional().default(""),
  porcentajeCoComprador: z.string().optional().default("50"),
});

type BoletoData = z.infer<typeof boletoSchema>;

function formatUsd(value: string | number | null | undefined): string {
  if (!value) return "";
  return Number(value).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function yearToSpanish(year: string): string {
  const map: Record<string, string> = {
    "2024": "dos mil veinticuatro",
    "2025": "dos mil veinticinco",
    "2026": "dos mil veintiséis",
    "2027": "dos mil veintisiete",
    "2028": "dos mil veintiocho",
    "2029": "dos mil veintinueve",
    "2030": "dos mil treinta",
    "2031": "dos mil treinta y uno",
    "2032": "dos mil treinta y dos",
    "2033": "dos mil treinta y tres",
    "2034": "dos mil treinta y cuatro",
    "2035": "dos mil treinta y cinco",
  };
  return map[year] ?? year;
}

function formatBirthDate(value: string): string {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const localMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const match = isoMatch ?? localMatch;

  if (!match) return trimmed;

  const day = isoMatch ? Number(match[3]) : Number(match[1]);
  const month = Number(match[2]);
  const year = isoMatch ? match[1] : match[3];
  const monthNames = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  if (day < 1 || day > 31 || month < 1 || month > 12) return trimmed;

  return `${day} de ${monthNames[month - 1]} de ${year}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const parcelaId = parseInt(id);
  if (isNaN(parcelaId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = boletoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const form: BoletoData = parsed.data;

  const [row] = await db
    .select({ parcela: parcelas, reserva: reservas, lead: leads })
    .from(parcelas)
    .leftJoin(reservas, activeReservaJoin())
    .leftJoin(leads, eq(reservas.leadId, leads.id))
    .where(eq(parcelas.id, parcelaId));

  if (!row) {
    return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
  }

  const parcela = flattenParcelaReserva(row.parcela, row.reserva, row.lead);
  const numeroCuotaEntrega = form.numeroCuotaEntrega.trim();
  const entregaCuota = form.entregaCuota && Boolean(numeroCuotaEntrega);

  // Build template data
  const data: Record<string, string | boolean> = {
    // Date
    dia: form.dia,
    mes: form.mes,
    anioLetras: yearToSpanish(form.anio),
    // Buyer (from form, pre-filled with DB values but overrideable)
    nombreComprador: form.nombreComprador || parcela.nombreComprador || "",
    dniComprador: form.dniComprador || parcela.dniCuit || "",
    nacionalidad: form.nacionalidad,
    fechaNacimiento: form.fechaNacimiento,
    fechaNacimientoLetras: formatBirthDate(form.fechaNacimiento),
    estadoCivil: form.estadoCivil,
    cuitComprador: form.cuitComprador,
    domicilioComprador: form.domicilioComprador,
    // Property (from DB)
    calleInmueble: form.calleInmueble || "",
    limites: form.limites || "",
    tituloPlano: form.tituloPlano || "Título",
    lote: parcela.parcela ?? "",
    manzana: parcela.manzana ?? "",
    medidas: form.medidas || (parcela.superficieM2 ? `${parcela.superficieM2} m²` : ""),
    parcelaCatastral: parcela.parcela ?? "",
    partida: parcela.partidaArba ?? "",
    matricula: parcela.matriculaFolio ?? "",
    // Segunda cláusula
    escritura: parcela.escritura ?? "",
    fechaEscritura: "",
    folio: "",
    matriculaSegunda: parcela.matriculaFolio ?? "",
    // Precio
    precioTotalPalabras: form.precioTotalPalabras || "",
    precioTotalNum: form.precioTotalNum || formatUsd(parcela.precioEtapa1),
    anticipoPalabras: form.anticipoPalabras || "",
    anticipoNum: form.anticipoNum || formatUsd(parcela.anticipoUsd),
    saldoPalabras: form.saldoPalabras || "",
    saldoNum: form.saldoNum || formatUsd(parcela.saldoUsd),
    cantidadCuotas: form.cantidadCuotas || "",
    cuotaMensualPalabras: form.cuotaMensualPalabras || "",
    cuotaMensual: form.cuotaMensual || formatUsd(parcela.cuotas48),
    entregaCuota,
    entregaAlSaldo: !entregaCuota,
    numeroCuotaEntrega,
  };

  // Select template based on payment type
  const templateName = form.tipoPago === "contado"
    ? "boleto-template-contado.docx"
    : "boleto-template-cuotas.docx";
  const templatePath = path.join(process.cwd(), "src", "templates", templateName);
  let templateBuf: Buffer;
  try {
    templateBuf = fs.readFileSync(templatePath);
  } catch {
    return NextResponse.json(
      { error: `Template no encontrado: ${templateName}` },
      { status: 500 }
    );
  }

  try {
    const zip = new PizZip(templateBuf);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(data);

    const buf: Buffer = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;

    const filename = `Boleto_Lote${parcela.parcela}_Manzana${parcela.manzana}.docx`;

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Error generating boleto:", err);
    return NextResponse.json(
      { error: "Error al generar el boleto" },
      { status: 500 }
    );
  }
}
