import * as XLSX from "xlsx";
import type { Parcela } from "@/lib/report-data";

type SigningSection = {
  title: string;
  range: { start: string; end: string };
  signings: Parcela[];
};

function fmt(value: string | number | null | undefined, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function parseMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: string | number | null | undefined) {
  const parsed = parseMoney(value);
  if (!parsed) return "-";
  return `U$S ${parsed.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

function diffMoney(value: number) {
  if (value < 0) return `U$S (${Math.abs(value).toLocaleString("en-US")})`;
  return `U$S ${value.toLocaleString("en-US")}`;
}

function modalidad(signing: Parcela) {
  const formaPago = signing.formaPago?.trim().toUpperCase();
  if (formaPago) return formaPago === "FINANCIADO" ? "CUOTAS" : formaPago;
  return parseMoney(signing.cantidadCuotas) > 0 ? "CUOTAS" : "CONTADO";
}

function medidas(signing: Parcela) {
  const frente = fmt(signing.metrosFrente);
  const fondo = fmt(signing.metrosFondo);
  return frente && fondo ? `${frente} x ${fondo}` : "";
}

function callesLinderas(signing: Parcela) {
  return [signing.calleLindera1, signing.calleLindera2].filter(Boolean).join(" y ");
}

function basePrice(signing: Parcela) {
  return signing.precioBase ?? signing.precioEtapa1;
}

function totalPrice(signing: Parcela) {
  return signing.precioTotalNum ?? signing.precioEtapa1;
}

function labelFor(signing: Parcela) {
  return `L${fmt(signing.parcela ?? signing.numero)}-M${fmt(signing.manzana)}\n${fmt(signing.nombreComprador)}`;
}

function ok(value: string | number | null | undefined) {
  return fmt(value) ? "OK" : "FALTA";
}

function buildNotas(sections: SigningSection[]) {
  const total = sections.reduce((sum, section) => sum + section.signings.length, 0);
  return [
    [`RESUMEN - Firmas previstas Barrio Stefani CRM`],
    [null],
    [`${total} boletos incluidos:`],
    ...sections.map((section) => [
      `  - ${section.title}: ${fmtDate(section.range.start)} al ${fmtDate(section.range.end)} (${section.signings.length})`,
    ]),
    [null],
    ["Datos sin fuente separada en el CRM y por eso pueden quedar vacios:"],
    ["  - Archivo generado"],
    ["  - Folio"],
    ["  - Fecha esc."],
    [null],
    ["Convenciones usadas:"],
    ["  - VALOR TOTAL del boleto = ANTICIPO + SALDO, cuando esos campos estan cargados."],
    ["  - Valor lote usa precio base y, si falta, precio etapa 1."],
    ["  - Valor total boleto usa precio total de la reserva y, si falta, precio etapa 1."],
  ];
}

function buildBoletosRows(sections: SigningSection[]) {
  let index = 1;
  return sections.flatMap((section) =>
    section.signings.map((signing) => ({
      "#": index++,
      Semana: section.title,
      "Archivo generado": "",
      Modalidad: modalidad(signing),
      "Fecha firma": fmtDate(signing.fechaFirma),
      "Nombre y apellido": fmt(signing.nombreComprador),
      DNI: fmt(signing.dniCuit),
      CUIT: fmt(signing.cuitComprador),
      Nacionalidad: fmt(signing.nacionalidad),
      "Fecha nac.": fmtDate(signing.fechaNacimiento),
      "Estado civil": fmt(signing.estadoCivil),
      Profesion: "",
      Domicilio: fmt(signing.domicilioComprador),
      Email: fmt(signing.emailComprador),
      Telefono: fmt(signing.telefono),
      Manzana: fmt(signing.manzana),
      Lote: fmt(signing.numero),
      Parcela: fmt(signing.parcela),
      "Sup. m2": fmt(signing.superficieM2),
      Medidas: medidas(signing),
      "Partida ARBA": fmt(signing.partidaArba),
      Matricula: fmt(signing.matriculaFolio),
      "Escritura N": fmt(signing.escritura),
      Folio: "",
      "Fecha esc.": "",
      "Calles frente": fmt(signing.calleFrente),
      "Calles linderas": callesLinderas(signing),
      "Valor lote (USD)": money(basePrice(signing)),
      "Valor total boleto (USD)": money(totalPrice(signing)),
      "Anticipo (USD)": money(signing.anticipoNum),
      "Saldo (USD)": money(signing.saldoNum),
      "Cant. cuotas": fmt(signing.cantidadCuotas, "0"),
      "Monto cuota (USD)": money(signing.cuotaMensual),
      Broker: fmt(signing.nombreCorredor),
    }))
  );
}

function buildChecklist(sections: SigningSection[]) {
  const signings = sections.flatMap((section) => section.signings);
  const headers = ["Campo", ...signings.map(labelFor)];
  const rows = [
    ["Nombre y apellido", ...signings.map((signing) => ok(signing.nombreComprador))],
    ["DNI", ...signings.map((signing) => ok(signing.dniCuit))],
    ["CUIT", ...signings.map((signing) => ok(signing.cuitComprador))],
    ["Nacionalidad", ...signings.map((signing) => ok(signing.nacionalidad))],
    ["Fecha nacimiento", ...signings.map((signing) => ok(signing.fechaNacimiento))],
    ["Estado civil", ...signings.map((signing) => ok(signing.estadoCivil))],
    ["Domicilio", ...signings.map((signing) => ok(signing.domicilioComprador))],
    ["Partida ARBA", ...signings.map((signing) => ok(signing.partidaArba))],
    ["Matricula", ...signings.map((signing) => ok(signing.matriculaFolio))],
    ["Escritura N", ...signings.map((signing) => ok(signing.escritura))],
    ["Folio", ...signings.map(() => "FALTA")],
    ["Calles frente", ...signings.map((signing) => ok(signing.calleFrente))],
    ["Calles linderas", ...signings.map((signing) => ok(callesLinderas(signing)))],
    ["Valor total", ...signings.map((signing) => ok(totalPrice(signing)))],
    ["Anticipo", ...signings.map((signing) => ok(signing.anticipoNum))],
    [
      "Saldo (si aplica)",
      ...signings.map((signing) => (modalidad(signing) === "CONTADO" ? "N/A" : ok(signing.saldoNum))),
    ],
    [
      "Cant. cuotas (si aplica)",
      ...signings.map((signing) =>
        modalidad(signing) === "CONTADO" ? "N/A" : ok(signing.cantidadCuotas)
      ),
    ],
    [
      "Monto cuota (si aplica)",
      ...signings.map((signing) =>
        modalidad(signing) === "CONTADO" ? "N/A" : ok(signing.cuotaMensual)
      ),
    ],
  ];
  return [headers, ...rows];
}

function buildValidationRows(sections: SigningSection[]) {
  let index = 1;
  return sections.flatMap((section) =>
    section.signings.map((signing) => {
      const anticipo = parseMoney(signing.anticipoNum);
      const cuotas = parseMoney(signing.cantidadCuotas);
      const cuota = parseMoney(signing.cuotaMensual);
      const cuotasTotal = cuotas * cuota;
      const saldo = parseMoney(signing.saldoNum);
      const total = parseMoney(totalPrice(signing));
      const modalidadValue = modalidad(signing);

      return {
        "#": index++,
        Semana: section.title,
        Lote: `M${fmt(signing.manzana)}-L${fmt(signing.parcela ?? signing.numero)}`,
        Comprador: fmt(signing.nombreComprador),
        Modalidad: modalidadValue,
        "Anticipo (a)": money(anticipo),
        "Cuotas (b)": cuotas,
        "Monto cuota (c)": money(cuota),
        "b x c (d)": money(cuotasTotal),
        "Saldo planilla (e)": money(saldo),
        "Diff (e-d)": diffMoney(saldo - cuotasTotal),
        "a + e (Total)": money(anticipo + saldo),
        "Total boleto (f)": money(total),
        "Diff (f-(a+e))": diffMoney(total - (anticipo + saldo)),
      };
    })
  );
}

function appendSheet(workbook: XLSX.WorkBook, name: string, data: unknown[][] | object[]) {
  const worksheet = Array.isArray(data[0])
    ? XLSX.utils.aoa_to_sheet(data as unknown[][])
    : XLSX.utils.json_to_sheet(data as object[]);
  worksheet["!cols"] = Array.from({ length: 36 }, () => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
}

export function buildWeeklySigningsExcel(sections: SigningSection[]) {
  const workbook = XLSX.utils.book_new();
  appendSheet(workbook, "Notas", buildNotas(sections));
  appendSheet(workbook, "Boletos firmas", buildBoletosRows(sections));
  appendSheet(workbook, "Checklist completitud", buildChecklist(sections));
  appendSheet(workbook, "Validacion montos", buildValidationRows(sections));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

