import { ContactForm } from "@/components/landing/contact-form";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Location } from "@/components/landing/location";
import { Navbar } from "@/components/landing/navbar";
import { Stats } from "@/components/landing/stats";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Features />
        <Location />
        <Faq />
        <section id="contacto" className="py-24 px-4 bg-primary">
          <div className="container mx-auto max-w-lg">
            <div className="text-center mb-10">
              <span className="font-body text-xs tracking-[0.25em] uppercase text-accent font-medium">
                Contacto
              </span>
              <h2 className="font-display text-4xl font-light text-primary-foreground mt-3 mb-3">
                ¿Te interesa un lote?
              </h2>
              <p className="font-body text-primary-foreground/55 text-sm">
                Dejanos tus datos y un asesor te contacta para ayudarte a elegir el lote ideal.
              </p>
            </div>
            <div className="bg-background rounded-sm shadow-2xl p-8">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
