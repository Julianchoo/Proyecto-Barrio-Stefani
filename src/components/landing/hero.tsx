import { Card, CardContent } from "@/components/ui/card";
import { TreePine, Users, Leaf } from "lucide-react";

const cards = [
  {
    icon: TreePine,
    title: "Boulevard Central",
    description: "4.150 m² de espacios verdes",
  },
  {
    icon: Users,
    title: "Áreas de Recreación",
    description: "Espacios diseñados para la familia",
  },
  {
    icon: Leaf,
    title: "Entorno Natural",
    description: "10 hectáreas de desarrollo sustentable",
  },
];

export function Hero() {
  return (
    <section
      className="relative py-32 px-4"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2000')",
        backgroundAttachment: "fixed",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* dark overlay */}
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative container mx-auto max-w-5xl text-center">
        <span className="inline-block text-sm font-medium text-green-300 bg-green-900/60 px-3 py-1 rounded-full mb-4 backdrop-blur-sm">
          Cuartel V · Moreno · Buenos Aires
        </span>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 drop-shadow-lg">
          Tu Hogar Rodeado de{" "}
          <span className="text-green-400">Naturaleza</span>
        </h1>
        <p className="text-xl text-gray-200 max-w-2xl mx-auto mb-12 drop-shadow">
          Barrio Stefani ofrece amplios espacios verdes y un boulevard central
          diseñado para disfrutar al aire libre con toda la infraestructura
          que necesitás.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {cards.map(({ icon: Icon, title, description }) => (
            <Card
              key={title}
              className="border-white/10 bg-white/10 backdrop-blur-md shadow-lg hover:bg-white/20 transition-colors"
            >
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-green-400/20">
                    <Icon className="h-6 w-6 text-green-300" />
                  </div>
                </div>
                <h3 className="font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-gray-300">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
