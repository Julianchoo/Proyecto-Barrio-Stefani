import { and, eq, notInArray, sql } from "drizzle-orm";
import Link from "next/link";
import { MapPin, Users, CheckCircle, Clock } from "lucide-react";

import { StatsCard } from "@/components/crm/stats-card";
import { db } from "@/lib/db";
import { parcelas, leads } from "@/lib/schema";
import { requireAuth } from "@/lib/session";

// Admin ve todos los leads; el comercial, solo los asignados a él ("Mis leads").
async function getStats(userId: string | null) {
  const misLeads = userId ? eq(leads.asignadoA, userId) : undefined;
  const [
    totalParcelas,
    disponibles,
    reservadas,
    vendidas,
    totalLeads,
    leadsNuevos,
    recentLeads,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(parcelas),
    db.select({ count: sql<number>`count(*)` }).from(parcelas).where(eq(parcelas.estado, "disponible")),
    db.select({ count: sql<number>`count(*)` }).from(parcelas).where(eq(parcelas.estado, "reservado")),
    db.select({ count: sql<number>`count(*)` }).from(parcelas).where(eq(parcelas.estado, "vendido")),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(misLeads),
    db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(
        userId
          ? and(misLeads, notInArray(leads.estado, ["closed_won", "closed_lost"]))
          : eq(leads.estado, "nuevo")
      ),
    db.select({
      id: leads.id,
      nombre: leads.nombre,
      email: leads.email,
      telefono: leads.telefono,
      estado: leads.estado,
      createdAt: leads.createdAt,
    })
      .from(leads)
      .where(misLeads)
      .orderBy(sql`${leads.createdAt} desc`)
      .limit(5),
  ]);

  return {
    totalParcelas: Number(totalParcelas[0]?.count ?? 0),
    disponibles: Number(disponibles[0]?.count ?? 0),
    reservadas: Number(reservadas[0]?.count ?? 0),
    vendidas: Number(vendidas[0]?.count ?? 0),
    totalLeads: Number(totalLeads[0]?.count ?? 0),
    leadsNuevos: Number(leadsNuevos[0]?.count ?? 0),
    recentLeads,
  };
}

const estadoBadge: Record<string, { bg: string; text: string; label: string }> = {
  nuevo: { bg: "bg-blue-100", text: "text-blue-700", label: "Nuevo" },
  asignado: { bg: "bg-purple-100", text: "text-purple-700", label: "Asignado" },
  a_contactar: { bg: "bg-orange-100", text: "text-orange-700", label: "A contactar" },
  contactado: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Contactado" },
  sin_respuesta: { bg: "bg-red-100", text: "text-red-700", label: "Sin respuesta" },
  closed_won: { bg: "bg-green-100", text: "text-green-700", label: "Cerrado ganado" },
  closed_lost: { bg: "bg-gray-100", text: "text-gray-600", label: "Cerrado perdido" },
};

export default async function CrmDashboard() {
  const session = await requireAuth();
  const esAdmin = session.user.role === "admin";
  const stats = await getStats(esAdmin ? null : session.user.id);
  const cardLink = "rounded-xl transition-opacity hover:opacity-80";

  return (
    <div className="space-y-8">
      <div className="border-b pb-6">
        <h1 className="font-display text-3xl font-light text-foreground">Dashboard</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Resumen general del proyecto Barrio Stefani</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/crm/lotes?estado=disponible" className={cardLink}>
          <StatsCard
            title="Lotes disponibles"
            value={stats.disponibles}
            description={`de ${stats.totalParcelas} totales`}
            icon={MapPin}
            accent="green"
          />
        </Link>
        <Link href="/crm/lotes?estado=reservado" className={cardLink}>
          <StatsCard
            title="Reservados"
            value={stats.reservadas}
            icon={Clock}
            accent="amber"
          />
        </Link>
        <Link href="/crm/lotes?estado=vendido" className={cardLink}>
          <StatsCard
            title="Vendidos"
            value={stats.vendidas}
            icon={CheckCircle}
            accent="blue"
          />
        </Link>
        {esAdmin ? (
          <Link href="/crm/leads?estado=nuevo" className={cardLink}>
            <StatsCard
              title="Leads nuevos"
              value={stats.leadsNuevos}
              description={`de ${stats.totalLeads} totales`}
              icon={Users}
              accent="red"
            />
          </Link>
        ) : (
          <Link href="/crm/leads" className={cardLink}>
            <StatsCard
              title="Mis leads"
              value={stats.leadsNuevos}
              description={`activos de ${stats.totalLeads} asignados`}
              icon={Users}
              accent="red"
            />
          </Link>
        )}
      </div>

      {/* Recent leads */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-body text-sm font-semibold text-foreground">
            {esAdmin ? "Últimos leads recibidos" : "Mis últimos leads"}
          </h2>
        </div>
        {stats.recentLeads.length === 0 ? (
          <p className="font-body text-sm text-muted-foreground py-10 text-center">
            {esAdmin ? "No hay leads aún." : "Todavía no tenés leads asignados."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.recentLeads.map((lead) => {
              const badge = estadoBadge[lead.estado] ?? { bg: "bg-gray-100", text: "text-gray-600", label: lead.estado };
              return (
                <li key={lead.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors">
                  <div className="min-w-0">
                    <p className="font-body text-sm font-semibold text-foreground truncate">{lead.nombre}</p>
                    <p className="font-body text-xs text-muted-foreground mt-0.5">{lead.email} · {lead.telefono}</p>
                  </div>
                  <span className={`ml-4 flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium font-body ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
