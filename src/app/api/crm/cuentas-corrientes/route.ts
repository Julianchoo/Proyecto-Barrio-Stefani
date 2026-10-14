import { NextResponse } from "next/server";
import { requireApiAdmin, isErrorResponse } from "@/lib/api-auth";
import { getCuentasCorrientesSummaries } from "@/lib/cuenta-corriente";
import type { ModalidadContrato } from "@/lib/schema";

export async function GET(request: Request) {
  const authResult = await requireApiAdmin();
  if (isErrorResponse(authResult)) return authResult;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const estado = searchParams.get("estado") ?? "";
  const modalidad = searchParams.get("modalidad") as ModalidadContrato | null;
  const reservadoPor = searchParams.get("reservadoPor") ?? "";
  const manzana = searchParams.get("manzana")?.trim().toLowerCase() ?? "";
  const parcela = searchParams.get("parcela")?.trim().toLowerCase() ?? "";
  const comprador = searchParams.get("comprador")?.trim().toLowerCase() ?? "";
  const fechaFirmaDesde = searchParams.get("fechaFirmaDesde") ?? "";
  const fechaFirmaHasta = searchParams.get("fechaFirmaHasta") ?? "";

  let rows = await getCuentasCorrientesSummaries();

  if (manzana) rows = rows.filter((row) => row.manzana?.toLowerCase() === manzana);
  if (parcela) rows = rows.filter((row) => row.parcela?.toLowerCase() === parcela);
  if (comprador) {
    rows = rows.filter((row) => row.comprador?.toLowerCase().includes(comprador));
  }
  if (fechaFirmaDesde) {
    rows = rows.filter((row) => row.fechaFirma !== null && row.fechaFirma >= fechaFirmaDesde);
  }
  if (fechaFirmaHasta) {
    rows = rows.filter((row) => row.fechaFirma !== null && row.fechaFirma <= fechaFirmaHasta);
  }

  if (reservadoPor) {
    rows = rows.filter((row) => row.reservadoPor === reservadoPor);
  }

  if (search) {
    rows = rows.filter((row) =>
      [
        row.comprador,
        row.dniCuit,
        row.email,
        row.telefono,
        String(row.loteNumero),
        row.manzana,
        row.parcela,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    );
  }

  if (modalidad) rows = rows.filter((row) => row.modalidad === modalidad);
  if (estado === "vencidas") rows = rows.filter((row) => row.cuotasVencidas > 0);
  if (estado === "pendiente_indice") {
    rows = rows.filter((row) => row.cuotasPendienteIndice > 0);
  }
  if (estado === "pendiente_cuenta") {
    rows = rows.filter((row) => row.cuentaEstado === "pendiente");
  }
  if (estado === "al_dia") {
    rows = rows.filter(
      (row) =>
        row.cuentaEstado === "creada" &&
        row.cuotasVencidas === 0
    );
  }

  return NextResponse.json(rows);
}
