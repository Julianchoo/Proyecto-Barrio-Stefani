import Image from "next/image";
import { ContactForm } from "@/components/landing/contact-form";

export function Contacto() {
  return (
    <section id="contacto" className="py-24 px-4 bg-primary">
      <div className="container mx-auto max-w-6xl grid gap-12 lg:grid-cols-2 lg:items-center">
        <div className="space-y-8">
          <div className="text-center lg:text-left">
            <span className="font-body text-xs tracking-[0.25em] uppercase text-accent font-medium">
              Contacto
            </span>
            <h2 className="font-display text-4xl font-light text-primary-foreground mt-3 mb-3">
              ¿Te interesa un lote?
            </h2>
            <p className="font-body text-primary-foreground/55 text-sm">
              Dejanos tus datos y un asesor te contacta para ayudarte a elegir el lote ideal
              o coordinar una visita al barrio.
            </p>
          </div>
          <div className="relative hidden aspect-[8/3] overflow-hidden rounded-sm shadow-2xl lg:block">
            <Image
              src="/cartel.png"
              alt="Cartel de Barrio Stefani: lotes en venta de 200 a 400 m², anticipo y hasta 60 cuotas, escritura"
              fill
              className="object-cover"
              sizes="50vw"
            />
          </div>
        </div>
        <div className="bg-background rounded-sm shadow-2xl p-8 w-full max-w-lg mx-auto">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
