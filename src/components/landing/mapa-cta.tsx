import Image from "next/image";
import Link from "next/link";
import { Map } from "lucide-react";

export function MapaCta() {
  return (
    <section className="relative overflow-hidden py-28 px-4 bg-primary">
      <Image
        src="/aerea_2026_2.jpeg"
        alt="Vista aérea de los lotes de Barrio Stefani junto a la Ruta 24"
        fill
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/10" />
      <div className="relative container mx-auto max-w-6xl">
        <div className="max-w-xl">
          <span className="font-body text-xs tracking-[0.25em] uppercase text-accent font-medium">
            Mapa de lotes
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-light text-primary-foreground mt-3 leading-tight">
            Elegí tu lote<br />sobre el plano real
          </h2>
          <p className="font-body text-primary-foreground/75 text-sm mt-4 leading-relaxed">
            Plano catastral oficial sobre foto satelital, con la disponibilidad actualizada.
            Tocá cualquier lote para ver superficie, medidas, nomenclatura, precio de lista y
            simular tu cuota.
          </p>
          <Link
            href="/mapa"
            className="mt-8 inline-flex items-center gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-body font-medium px-8 py-3.5 rounded-sm transition-colors tracking-wide text-sm"
          >
            <Map className="h-4 w-4" /> Abrir el mapa
          </Link>
        </div>
      </div>
    </section>
  );
}
