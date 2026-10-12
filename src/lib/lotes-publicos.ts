import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { currentReservaJoin } from "@/lib/reservas";
import type { LoteMapa } from "@/lib/lotes-mapa";
import { parcelas, reservas, type EstadoParcela } from "@/lib/schema";

export async function getLotesPublicos(): Promise<LoteMapa[]> {
  const rows = await db
    .select({
      id: parcelas.id,
      manzana: parcelas.manzana,
      parcela: parcelas.parcela,
      circunscripcion: parcelas.circunscripcion,
      seccion: parcelas.seccion,
      partidaArba: parcelas.partidaArba,
      superficieM2: parcelas.superficieM2,
      metrosFrente: parcelas.metrosFrente,
      metrosFondo: parcelas.metrosFondo,
      estado: parcelas.estado,
      precioBase: parcelas.precioBase,
      reservaEstado: reservas.estado,
    })
    .from(parcelas)
    .leftJoin(reservas, currentReservaJoin())
    .orderBy(asc(parcelas.numero));

  return rows.map(({ precioBase, reservaEstado, ...lote }) => {
    // Igual que en /crm/lotes: una reserva realizada cuenta como vendido.
    const estado: EstadoParcela = reservaEstado === "realizada" ? "vendido" : lote.estado;
    const precio = Number(precioBase);
    return {
      ...lote,
      estado,
      precio: estado === "disponible" && precioBase && precio > 0 ? precio : null,
    };
  });
}
