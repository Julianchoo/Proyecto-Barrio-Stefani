"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Navbar() {
  const scrollToContact = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:gap-6">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
          <Image
            src="/logo_full.jpeg"
            alt="Barrio Stefani"
            width={40}
            height={40}
            className="rounded-sm object-cover"
          />
          <div className="leading-tight text-primary">
            <div className="font-display text-base font-semibold tracking-wide sm:hidden">
              <span className="block leading-tight">Barrio</span>
              <span className="block leading-tight">Stefani</span>
            </div>
            <span className="hidden font-display text-lg font-semibold tracking-wide sm:inline">
              Barrio Stefani
            </span>
          </div>
        </Link>
        <nav className="flex flex-none items-center justify-end gap-2 sm:gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary sm:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Navegación</SheetTitle>
              </SheetHeader>
              <div className="p-4">
                <Link
                  href="/login"
                  className="block rounded-sm border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-muted"
                >
                  Ingresar
                </Link>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden text-muted-foreground hover:text-primary hover:bg-primary/5 font-body sm:inline-flex"
          >
            <Link href="/login">Ingresar</Link>
          </Button>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-body tracking-wide"
            onClick={scrollToContact}
          >
            Quiero mi lote
          </Button>
        </nav>
      </div>
    </header>
  );
}
