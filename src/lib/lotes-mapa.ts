// Sin imports de servidor: lo usan tanto /api/mapa como el mapa en el navegador.
import type { EstadoParcela } from "@/lib/schema";

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

// Para el público solo existe "a la venta" o no: reservado/vendido se muestran como no disponible.
export function soloDisponibilidad(lote: LoteMapa): LoteMapa {
  return lote.estado === "disponible" ? lote : { ...lote, estado: "no_disponible" };
}
