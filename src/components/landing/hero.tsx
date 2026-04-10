"use client";

import Image from "next/image";
import { ArrowDown } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-[92vh] flex flex-col justify-end overflow-hidden">
      {/* Background aerial photo */}
      <div className="absolute inset-0">
        <Image
          src="/foto_aerea1.jpeg"
          alt="Vista aérea de Barrio Stefani"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>

      {/* Gradient overlay - bottom-heavy for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0D1F17]/90 via-[#0D1F17]/40 to-transparent" />

      {/* Top badge */}
      <div className="absolute top-8 left-0 right-0 flex justify-center">
        <span className="text-xs font-body tracking-[0.25em] uppercase text-[#F7F3ED]/60 border border-[#F7F3ED]/20 px-4 py-1.5 rounded-full backdrop-blur-sm bg-black/10">
          Cuartel V · Moreno · Buenos Aires
        </span>
      </div>

      {/* Main content — bottom aligned */}
      <div className="relative container mx-auto max-w-6xl px-6 pb-16 md:pb-24">
        <div className="max-w-3xl">
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-light text-[#F7F3ED] leading-[0.95] tracking-tight mb-6">
            Tu Hogar<br />
            <em className="not-italic text-[#B8963E]">Rodeado de</em><br />
            Naturaleza
          </h1>
          <p className="font-body text-lg text-[#F7F3ED]/70 max-w-xl mb-10 leading-relaxed">
            Barrio Stefani — 360+ lotes en 10 hectáreas con boulevard central,
            calles iluminadas e infraestructura completa. Financiación en hasta 60 cuotas.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#contacto"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 bg-[#B8963E] hover:bg-[#B8963E]/90 text-white font-body font-medium px-8 py-3.5 rounded-sm transition-colors tracking-wide text-sm"
            >
              Quiero mi lote
            </a>
            <a
              href="#proyecto"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("proyecto")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="font-body text-sm text-[#F7F3ED]/60 hover:text-[#F7F3ED] transition-colors tracking-wide flex items-center gap-2"
            >
              Ver el proyecto <ArrowDown className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 right-6 hidden md:flex flex-col items-center gap-2 opacity-40">
        <div className="w-px h-12 bg-[#F7F3ED] animate-pulse" />
        <span className="font-body text-[10px] text-[#F7F3ED] tracking-[0.2em] uppercase rotate-90 origin-center mt-4">
          Scroll
        </span>
      </div>
    </section>
  );
}
