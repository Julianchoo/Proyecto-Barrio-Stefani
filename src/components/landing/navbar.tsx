"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const scrollToContact = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1B3A2D]/10 bg-[#F7F3ED]/95 backdrop-blur supports-[backdrop-filter]:bg-[#F7F3ED]/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo_full.jpeg"
            alt="Barrio Stefani"
            width={40}
            height={40}
            className="rounded-sm object-cover"
          />
          <div className="flex flex-col leading-none">
            <span className="font-display text-[#1B3A2D] text-lg font-semibold tracking-wide">
              Barrio Stefani
            </span>
            <span className="text-[10px] text-[#1B3A2D]/50 tracking-[0.2em] uppercase font-body">
              Cuartel V · Moreno
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-[#1B3A2D]/70 hover:text-[#1B3A2D] hover:bg-[#1B3A2D]/5 font-body"
          >
            <Link href="/login">Ingresar</Link>
          </Button>
          <Button
            size="sm"
            className="bg-[#1B3A2D] hover:bg-[#1B3A2D]/90 text-[#F7F3ED] font-body tracking-wide"
            onClick={scrollToContact}
          >
            Quiero mi lote
          </Button>
        </nav>
      </div>
    </header>
  );
}
