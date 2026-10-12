import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { currentReservaJoin } from "@/lib/reservas";
import { parcelas, reservas, type EstadoParcela } from "@/lib/schema";

// Datos de un lote que se pueden mostrar sin login: catastro, estado y precio de lista.
// Nunca agregar acá datos de la reserva o del comprador.
export type LoteMapa = {
  id: number;
  manzana: string | null;
  parcela: string | null;
  circunscripcion: string | null;
  seccion: string | null;
  partidaArba: string | null;
  superficieM2: string | null;
  metrosFrente: string | null;
  metrosFondo: string | null;
  estado: EstadoParcela;
  // Precio de lista (precio base), sólo si el lote está disponible.
  precio: number | null;
};

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
