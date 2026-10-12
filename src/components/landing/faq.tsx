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
    a: "Contamos con lotes de 200 a 400 m² aproximadamente, ideales para construir tu casa en un barrio planificado con infraestructura completa. También hay lotes comerciales para tu emprendimiento. En el mapa de lotes podés ver la superficie y las medidas de cada uno.",
  },
  {
    q: "¿Se puede financiar la compra del lote?",
    a: "¡Sí! Con un anticipo desde el 19% del precio de lista, el saldo se paga en hasta 60 cuotas mensuales. También podés pagar al contado. En el mapa de lotes podés simular la cuota de cada lote.",
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
    q: "¿Se escritura el lote?",
    a: "Sí. Los lotes se venden con escritura, y cada uno tiene su nomenclatura catastral y partida en ARBA, que podés ver en el mapa de lotes.",
  },
  {
    q: "¿Cuándo tengo la posesión del lote?",
    a: "La posesión se entrega al completar el pago del 50% del precio. El simulador te muestra en qué cuota se da según el anticipo y el plazo que elijas.",
  },
  {
    q: "¿Es posible visitar el lote antes de comprar?",
    a: "¡Por supuesto! Coordinamos visitas al terreno para que puedas recorrer el loteo, conocer la ubicación y elegir el lote que más te convenga. Contactanos para agendar tu visita.",
  },
];

export function Faq() {
  return (
    <section className="py-24 px-4 bg-background">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <span className="font-body text-xs tracking-[0.25em] uppercase text-accent font-medium">
            Preguntas frecuentes
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-light text-primary mt-3">
            Todo lo que necesitás saber
          </h2>
        </div>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border rounded-sm px-4"
            >
              <AccordionTrigger className="text-left font-body font-medium text-primary hover:no-underline py-4">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="font-body text-muted-foreground pb-4 leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
