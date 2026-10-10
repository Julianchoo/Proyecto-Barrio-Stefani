"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  TreePine,
  Users,
  UserCog,
} from "lucide-react";
import { BnaExchangeRateIndicator } from "@/components/bna-exchange-rate-indicator";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const baseNavItems = [
  { href: "/crm", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/crm/lotes", icon: MapPin, label: "Lotes" },
  { href: "/crm/reservas", icon: CalendarDays, label: "Reservas" },
  { href: "/crm/leads", icon: Users, label: "Leads" },
];

function NavLinks({ role, onClose }: { role?: string; onClose?: () => void }) {
  const pathname = usePathname();
  const items = role === "admin"
    ? [
        ...baseNavItems,
        { href: "/crm/cuotas", icon: CreditCard, label: "Cuotas" },
        { href: "/crm/usuarios", icon: UserCog, label: "Usuarios" },
      ]
    : baseNavItems;

  return (
    <nav className="flex-1 space-y-1 px-3">
      {items.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          {...(onClose ? { onClick: onClose } : {})}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === href
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { data: session } = useSession();
  const router = useRouter();
  const role: string | undefined = (session?.user as { role?: string } | undefined)?.role;
  const canViewRate = role === "admin" || role === "comercial";

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <TreePine className="h-5 w-5 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">Barrio Stefani</span>
        <ModeToggle />
      </div>

      <div className="flex-1 py-4 overflow-y-auto">
        <NavLinks
          {...(role !== undefined ? { role } : {})}
          {...(onClose !== undefined ? { onClose } : {})}
        />
      </div>

      <div className="border-t p-4 space-y-3">
        <BnaExchangeRateIndicator
          enabled={canViewRate}
          className="flex flex-col rounded-lg border bg-muted/40 px-3 py-2"
        />
        <div className="px-3">
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {session?.user?.name}
          </p>
          <p className="text-xs text-sidebar-foreground/70 truncate">{session?.user?.email}</p>
          <span className="mt-1 inline-block text-xs bg-green-100 text-primary px-2 py-0.5 rounded-full capitalize">
            {role ?? "comercial"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

export function CrmSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center h-14 px-4 border-b bg-sidebar text-sidebar-foreground">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-56 bg-sidebar p-0 text-sidebar-foreground">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <span className="ml-3 flex-1 text-sm font-semibold">Barrio Stefani</span>
        <ModeToggle />
      </div>
    </>
  );
}
