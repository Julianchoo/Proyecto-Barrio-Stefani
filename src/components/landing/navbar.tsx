"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

export function Navbar() {
  const { data: session } = useSession();
  const ingresar = session
    ? { href: "/crm", label: "Ir al CRM" }
    : { href: "/login", label: "Ingresar" };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:gap-6">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
          <Image
            src="/torre-agua.svg"
            alt=""
            width={40}
            height={40}
            className="shrink-0"
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
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-muted-foreground hover:text-primary hover:bg-primary/5 font-body"
          >
            <Link href={ingresar.href}>{ingresar.label}</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-body tracking-wide"
          >
            <Link href="/mapa">Quiero mi lote</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
