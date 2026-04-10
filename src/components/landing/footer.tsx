import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground/40 py-12 px-4">
      <div className="container mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logo_full.jpeg"
            alt="Barrio Stefani"
            width={32}
            height={32}
            className="rounded-sm object-cover opacity-80"
          />
          <div className="flex flex-col leading-none">
            <span className="font-display text-primary-foreground/80 font-medium">Barrio Stefani</span>
            <span className="font-body text-[9px] tracking-[0.2em] uppercase text-primary-foreground/30 mt-0.5">
              Cuartel V · Moreno · Bs. As.
            </span>
          </div>
        </div>
        <p className="font-body text-xs text-center">
          Cuartel V, Moreno, Provincia de Buenos Aires
        </p>
        <p className="font-body text-xs">© 2025 Barrio Stefani. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
