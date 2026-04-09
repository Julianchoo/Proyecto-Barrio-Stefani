"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Users,
  UserCog,
  LogOut,
  TreePine,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/crm", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/crm/lotes", icon: MapPin, label: "Lotes" },
  { href: "/crm/leads", icon: Users, label: "Leads" },
];

function NavLinks({ role, onClose }: { role?: string; onClose?: () => void }) {
  const pathname = usePathname();
  const items = role === "admin"
    ? [...navItems, { href: "/crm/usuarios", icon: UserCog, label: "Usuarios" }]
    : navItems;

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
              ? "bg-green-100 text-green-800"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <TreePine className="h-5 w-5 text-green-700" />
        <span className="font-semibold text-sm">Barrio Stefani</span>
      </div>

      <div className="flex-1 py-4 overflow-y-auto">
        <NavLinks
          {...(role !== undefined ? { role } : {})}
          {...(onClose !== undefined ? { onClose } : {})}
        />
      </div>

      <div className="border-t p-4 space-y-3">
        <div className="px-3">
          <p className="text-sm font-medium text-gray-900 truncate">
            {session?.user?.name}
          </p>
          <p className="text-xs text-gray-500 truncate">{session?.user?.email}</p>
          <span className="mt-1 inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full capitalize">
            {role ?? "comercial"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-600 hover:text-gray-900"
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
      <aside className="hidden md:flex w-56 flex-col border-r bg-white fixed inset-y-0 left-0 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center h-14 px-4 border-b bg-white">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-56">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <span className="ml-3 font-semibold text-sm">Barrio Stefani</span>
      </div>
    </>
  );
}
