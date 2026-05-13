import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads, parcelas, reservas } from "@/lib/schema";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { activeReservaJoin, flattenParcelaReserva } from "@/lib/reservas";
import { amountToSpanishWords } from "@/lib/number-words";

const PizZip = require("pizzip"); // eslint-disable-line @typescript-eslint/no-require-imports
const Docxtemplater = require("docxtemplater"); // eslint-disable-line @typescript-eslint/no-require-imports

const reservaSchema = z.object({
  dia: z.string().optional().default(""),
  mes: z.string().optional().default(""),
  anio: z.string().optional().default(""),
  nombreComprador: z.string().optional().default(""),
  dniComprador: z.string().optional().default(""),
  domicilioComprador: z.string().optional().default(""),
  reservaPalabras: z.string().optional().default(""),
  reservaNum: z.string().optional().default(""),
  lote: z.string().optional().default(""),
  manzana: z.string().optional().default(""),
  calleFrente: z.string().optional().default(""),
  precioTotalPalabras: z.string().optional().default(""),
  precioTotalNum: z.string().optional().default(""),
  anticipoPalabras: z.string().optional().default(""),
  anticipoNum: z.string().optional().default(""),
  saldoPalabras: z.string().optional().default(""),
  saldoNum: z.string().optional().default(""),
  cantidadCuotas: z.string().optional().default(""),
  cuotaMensualPalabras: z.string().optional().default(""),
  cuotaMensual: z.string().optional().default(""),
  numeroCuotaEntrega: z.string().optional().default(""),
  nombreCorredor: z.string().optional().default(""),
  dniCorredor: z.string().optional().default(""),
  honorariosPalabras: z.string().optional().default("CUATROCIENTOS CINCUENTA"),
  honorariosNum: z.string().optional().default("450"),
});

function formatMoney(value: string | number | null | undefined): string {
  if (!value) return "";
  const numeric = Number(String(value).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function wordsOrAmount(words: string, amount: string) {
  return words || amountToSpanishWords(amount) || "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth();
  if (isErrorResponse(authResult)) return authResult;

  const { id } = await params;
  const parcelaId = parseInt(id);
  if (isNaN(parcelaId)) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = reservaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const [row] = await db
    .select({ parcela: parcelas, reserva: reservas, lead: leads })
    .from(parcelas)
    .leftJoin(reservas, activeReservaJoin())
    .leftJoin(leads, eq(reservas.leadId, leads.id))
    .where(eq(parcelas.id, parcelaId));

  if (!row) {
    return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
  }
  if (!row.reserva) {
    return NextResponse.json(
      { error: "El lote no tiene una reserva activa" },
      { status: 400 }
    );
  }

  const isReservedByOther =
    row.parcela.estado === "reservado" &&
    authResult.role !== "admin" &&
    row.reserva.reservadoPor !== authResult.email;
  if (isReservedByOther) {
    return NextResponse.json(
      { error: "Este lote fue reservado por otro comercial" },
      { status: 403 }
    );
  }

  const form = parsed.data;
  const parcela = flattenParcelaReserva(row.parcela, row.reserva, row.lead);
  const anticipoNum = form.anticipoNum || formatMoney(parcela.anticipoNum);
  const reservaNum = form.reservaNum || anticipoNum;
  const precioTotalNum = form.precioTotalNum || formatMoney(parcela.precioTotalNum);
  const saldoNum = form.saldoNum || formatMoney(parcela.saldoNum);
  const cuotaMensual = form.cuotaMensual || formatMoney(parcela.cuotaMensual);

  const data: Record<string, string> = {
    dia: form.dia,
    mes: form.mes,
    anio: form.anio,
    nombreComprador: form.nombreComprador || parcela.nombreComprador || "",
    dniComprador: form.dniComprador || parcela.dniCuit || "",
    domicilioComprador: form.domicilioComprador || parcela.domicilioComprador || "",
    reservaPalabras: wordsOrAmount(form.reservaPalabras, reservaNum),
    reservaNum,
    lote: form.lote || parcela.parcela || "",
    manzana: form.manzana || parcela.manzana || "",
    calleFrente: form.calleFrente || parcela.calleFrente || "",
    precioTotalPalabras: wordsOrAmount(form.precioTotalPalabras, precioTotalNum),
    precioTotalNum,
    anticipoPalabras: wordsOrAmount(form.anticipoPalabras, anticipoNum),
    anticipoNum,
    saldoPalabras: wordsOrAmount(form.saldoPalabras, saldoNum),
    saldoNum,
    cantidadCuotas: form.cantidadCuotas || parcela.cantidadCuotas || "",
    cuotaMensualPalabras: wordsOrAmount(form.cuotaMensualPalabras, cuotaMensual),
    cuotaMensual,
    numeroCuotaEntrega:
      form.numeroCuotaEntrega ||
      (parcela.tipoEntrega === "cuota" ? parcela.mesEntrega || "" : ""),
    nombreCorredor: form.nombreCorredor || parcela.nombreCorredor || "",
    dniCorredor: form.dniCorredor,
    honorariosPalabras: form.honorariosPalabras || "CUATROCIENTOS CINCUENTA",
    honorariosNum: form.honorariosNum || "450",
  };

  const templatePath = path.join(
    process.cwd(),
    "src",
    "templates",
    "reserva-template.docx"
  );
  let templateBuf: Buffer;
  try {
    templateBuf = fs.readFileSync(templatePath);
  } catch {
    return NextResponse.json(
      { error: "Template de reserva no encontrado" },
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
    const filename = `Reserva_Lote${parcela.parcela}_Manzana${parcela.manzana}.docx`;

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating reserva:", error);
    return NextResponse.json(
      { error: "Error al generar la reserva" },
      { status: 500 }
    );
  }
}
