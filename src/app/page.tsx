import { Contacto } from "@/components/landing/contacto";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Financiacion } from "@/components/landing/financiacion";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Location } from "@/components/landing/location";
import { MapaCta } from "@/components/landing/mapa-cta";
import { Navbar } from "@/components/landing/navbar";
import { Stats } from "@/components/landing/stats";
import { getLotesPublicos } from "@/lib/lotes-publicos";

// Disponibilidad y precio "desde" se refrescan cada hora.
export const revalidate = 3600;

async function getResumen() {
  try {
    const disponibles = (await getLotesPublicos()).filter((l) => l.estado === "disponible");
    const precios = disponibles.map((l) => l.precio).filter((p): p is number => p !== null);
    return {
      disponibles: disponibles.length || null,
      precioDesde: precios.length ? Math.min(...precios) : null,
    };
  } catch {
    // build:ci corre sin base: la home sale con los textos generales.
    return { disponibles: null, precioDesde: null };
  }
}

export default async function HomePage() {
  const { disponibles, precioDesde } = await getResumen();

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats disponibles={disponibles} precioDesde={precioDesde} />
        <Features />
        <MapaCta />
        <Financiacion precioDesde={precioDesde} />
        <Location />
        <Faq />
        <Contacto />
      </main>
      <Footer />
    </>
  );
}
