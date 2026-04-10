import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "¿Dónde se encuentra ubicado el loteo?",
    a: "El Barrio Stefani se encuentra en Cuartel V, Moreno, frente a la fábrica de cerámica Juan Stefani. Una zona residencial tranquila en pleno desarrollo, con excelente acceso a rutas principales y cercanía a servicios, colegios y comercios.",
  },
  {
    q: "¿Qué tamaños tienen los lotes disponibles?",
    a: "Contamos con lotes entre 210 y 400 metros cuadrados aproximadamente, ideales para construir la casa de tus sueños en un barrio planificado con infraestructura completa. También contamos con lotes para uso comercial para que lleves a cabo tu emprendimiento soñado.",
  },
  {
    q: "¿Se puede financiar la compra del lote?",
    a: "¡Sí! Ofrecemos financiación de hasta 60 cuotas sin interés. Además, tenemos opciones de pago al contado a valor promocional para quienes prefieren aprovechar el mejor precio.",
  },
  {
    q: "¿Qué servicios están disponibles en el loteo?",
    a: "El barrio contará con: red eléctrica aérea de media tensión (EDENOR), 120 luminarias LED, desagüe pluvial por zanjas con 14 pases hidráulicos, calles internas con sub-base compactada y terminación en piedra partida, boulevard central de 4.150 m² y sistema de efluentes mediante biodigestores individuales. El agua será mediante perforación individual en cada lote.",
  },
  {
    q: "¿Cuándo estarán listos los lotes para construir?",
    a: "La entrega de los lotes está proyectada para fines de 2026, una vez finalizadas todas las obras de infraestructura que incluyen 14.130 m² de calles, el boulevard, iluminación LED y sistema de drenaje pluvial completo.",
  },
  {
    q: "¿Es posible visitar el lote antes de comprar?",
    a: "¡Por supuesto! Coordinamos visitas al terreno para que puedas recorrer el loteo, conocer la ubicación y elegir el lote que más te convenga. Contactanos para agendar tu visita.",
  },
];

export function Faq() {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <span className="text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
            Preguntas frecuentes
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mt-4">
            Todo lo que necesitás saber
          </h2>
        </div>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="text-left font-medium text-gray-900 hover:no-underline py-4">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 pb-4 leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
