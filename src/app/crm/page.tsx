import { db } from "@/lib/db";
import { parcelas, leads } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { StatsCard } from "@/components/crm/stats-card";
import { MapPin, Users, CheckCircle, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function getStats() {
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
    db
      .select({ count: sql<number>`count(*)` })
      .from(parcelas)
      .where(eq(parcelas.estado, "disponible")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(parcelas)
      .where(eq(parcelas.estado, "reservado")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(parcelas)
      .where(eq(parcelas.estado, "vendido")),
    db.select({ count: sql<number>`count(*)` }).from(leads),
    db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.estado, "nuevo")),
    db
      .select({
        id: leads.id,
        nombre: leads.nombre,
        email: leads.email,
        telefono: leads.telefono,
        estado: leads.estado,
        createdAt: leads.createdAt,
      })
      .from(leads)
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

const estadoBadgeColor: Record<string, string> = {
  nuevo: "bg-blue-100 text-blue-700",
  asignado: "bg-purple-100 text-purple-700",
  a_contactar: "bg-orange-100 text-orange-700",
  contactado: "bg-yellow-100 text-yellow-700",
  sin_respuesta: "bg-red-100 text-red-700",
  closed_won: "bg-green-100 text-green-700",
  closed_lost: "bg-gray-100 text-gray-700",
};

export default async function CrmDashboard() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Resumen general del proyecto Barrio Stefani
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          title="Lotes disponibles"
          value={stats.disponibles}
          description={`de ${stats.totalParcelas} totales`}
          icon={MapPin}
        />
        <StatsCard
          title="Reservados"
          value={stats.reservadas}
          icon={Clock}
        />
        <StatsCard
          title="Vendidos"
          value={stats.vendidas}
          icon={CheckCircle}
        />
        <StatsCard
          title="Leads nuevos"
          value={stats.leadsNuevos}
          description={`de ${stats.totalLeads} totales`}
          icon={Users}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos leads recibidos</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentLeads.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No hay leads aún. Serán visibles una vez que se reciban consultas.
            </p>
          ) : (
            <ul className="divide-y">
              {stats.recentLeads.map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {lead.nombre}
                    </p>
                    <p className="text-xs text-gray-500">
                      {lead.email} · {lead.telefono}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoBadgeColor[lead.estado]}`}
                  >
                    {lead.estado}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
