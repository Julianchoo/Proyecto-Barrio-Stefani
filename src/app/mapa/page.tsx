import { CompartirMapaButton } from "@/components/compartir-mapa-button";
import { Contacto } from "@/components/landing/contacto";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { MapaLotes } from "@/components/mapa-lotes";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mapa de lotes",
  description:
    "Plano de Barrio Stefani con los lotes disponibles, datos catastrales, precio de lista y simulador de cuotas.",
};

export default function MapaPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="py-12 px-4 bg-background">
          <div className="container mx-auto max-w-7xl space-y-6">
            <div>
              <span className="font-body text-xs tracking-[0.25em] uppercase text-accent font-medium">
                Mapa de lotes
              </span>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-4xl md:text-5xl font-light text-primary leading-tight">
                  Elegí tu lote
                </h1>
                <CompartirMapaButton variant="outline" size="sm" />
              </div>
              <p className="font-body text-muted-foreground text-sm mt-3 max-w-2xl">
                Plano catastral oficial sobre foto satelital, actualizado con la disponibilidad
                del día. Tocá un lote para ver superficie, medidas, precio de lista y simular la cuota.
              </p>
            </div>
            <MapaLotes publico />
          </div>
        </section>
        <Contacto />
      </main>
      <Footer />
    </>
  );
}
