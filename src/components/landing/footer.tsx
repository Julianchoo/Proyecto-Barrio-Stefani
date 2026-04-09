import { TreePine } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-10 px-4">
      <div className="container mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-white">
          <TreePine className="h-5 w-5 text-green-500" />
          <span className="font-semibold">Barrio Stefani</span>
        </div>
        <p className="text-sm text-center">
          Cuartel V, Moreno, Provincia de Buenos Aires
        </p>
        <p className="text-sm">© 2025 Barrio Stefani. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
