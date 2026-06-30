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

  let rows = await getCuentasCorrientesSummaries();

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
  if (estado === "proyectadas") {
    rows = rows.filter((row) => row.cuotasProyectadas > 0);
  }
  if (estado === "pendiente_cuenta") {
    rows = rows.filter((row) => row.cuentaEstado === "pendiente");
  }
  if (estado === "al_dia") {
    rows = rows.filter(
      (row) =>
        row.cuentaEstado === "creada" &&
        row.cuotasVencidas === 0 &&
        row.cuotasPendienteIndice === 0 &&
        row.cuotasProyectadas === 0
    );
  }

  return NextResponse.json(rows);
}
