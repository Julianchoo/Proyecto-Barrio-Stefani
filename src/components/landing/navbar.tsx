"use client";

import Link from "next/link";
import { TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const scrollToContact = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <TreePine className="h-6 w-6 text-green-700" />
          <span className="font-semibold text-lg tracking-tight">
            Barrio Stefani
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Ingresar</Link>
          </Button>
          <Button
            size="sm"
            className="bg-green-700 hover:bg-green-800 text-white"
            onClick={scrollToContact}
          >
            Quiero mi lote
          </Button>
        </nav>
      </div>
    </header>
  );
}
