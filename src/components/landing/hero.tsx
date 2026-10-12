"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, Map } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-[92vh] flex flex-col justify-end overflow-hidden bg-primary">
      <Image
        src="/foto_aerea1.jpeg"
        alt="Vista aérea de Barrio Stefani"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      {/* Gradient overlay - bottom-heavy for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      {/* Top badge */}
      <div className="absolute top-8 left-0 right-0 flex justify-center">
        <span className="text-xs font-body tracking-[0.25em] uppercase text-primary-foreground/60 border border-primary-foreground/20 px-4 py-1.5 rounded-full backdrop-blur-sm bg-black/10">
          Cuartel V – Moreno – Buenos Aires
        </span>
      </div>

      {/* Main content — bottom aligned */}
      <div className="relative container mx-auto max-w-6xl px-6 pb-16 md:pb-24">
        <div className="max-w-3xl">
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-light text-primary-foreground leading-[0.95] tracking-tight mb-6">
            Tu Hogar
            <br />
            <em className="not-italic text-primary-foreground">Rodeado de</em>
            <br />
            Naturaleza
          </h1>
          <p className="font-body text-lg text-primary-foreground/70 max-w-xl mb-10 leading-relaxed">
            Lotes residenciales y comerciales de 200 a 400 m² en Cuartel V, Moreno.
            Anticipo y hasta 60 cuotas en dólares, con escritura.
          </p>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link
              href="/mapa"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-body font-medium px-8 py-3.5 rounded-sm transition-colors tracking-wide text-sm"
            >
              <Map className="h-4 w-4" /> Ver lotes disponibles
            </Link>
            <a
              href="#contacto"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 border border-primary-foreground/40 hover:bg-primary-foreground/10 text-primary-foreground font-body font-medium px-8 py-3.5 rounded-sm transition-colors tracking-wide text-sm"
            >
              Quiero mi lote
            </a>
            <a
              href="#proyecto"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("proyecto")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="font-body text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors tracking-wide flex items-center gap-2"
            >
              Ver el proyecto <ArrowDown className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 right-6 hidden md:flex flex-col items-center gap-2 opacity-40">
        <div className="w-px h-12 bg-primary-foreground animate-pulse" />
        <span className="font-body text-[10px] text-primary-foreground tracking-[0.2em] uppercase rotate-90 origin-center mt-4">
          Scroll
        </span>
      </div>
    </section>
  );
}
