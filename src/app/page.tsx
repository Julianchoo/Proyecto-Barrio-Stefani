import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Stats } from "@/components/landing/stats";
import { Features } from "@/components/landing/features";
import { Location } from "@/components/landing/location";
import { Faq } from "@/components/landing/faq";
import { ContactForm } from "@/components/landing/contact-form";
import { Footer } from "@/components/landing/footer";

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
        <section id="contacto" className="py-20 px-4 bg-green-50">
          <div className="container mx-auto max-w-lg">
            <div className="text-center mb-10">
              <span className="text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
                Contacto
              </span>
              <h2 className="text-3xl font-bold text-gray-900 mt-4 mb-3">
                ¿Te interesa un lote?
              </h2>
              <p className="text-gray-500">
                Dejanos tus datos y un asesor te contacta para ayudarte a
                elegir el lote ideal.
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border p-8">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
