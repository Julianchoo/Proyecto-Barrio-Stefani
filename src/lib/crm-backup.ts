import { gzipSync } from "node:zlib";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditLog,
  contratos,
  cuotas,
  indicesCac,
  leads,
  pagos,
  parcelas,
  reservas,
  tiposCambio,
  user,
} from "@/lib/schema";

// Sin session/verification (efimeras) ni account (hashes de contraseñas).
export async function createCrmBackup() {
  const [
    parcelasRows,
    reservasRows,
    leadsRows,
    contratosRows,
    cuotasRows,
    pagosRows,
    tiposCambioRows,
    indicesCacRows,
    auditLogRows,
    userRows,
  ] = await Promise.all([
    db.select().from(parcelas).orderBy(asc(parcelas.id)),
    db.select().from(reservas).orderBy(asc(reservas.id)),
    db.select().from(leads).orderBy(asc(leads.id)),
    db.select().from(contratos).orderBy(asc(contratos.id)),
    db.select().from(cuotas).orderBy(asc(cuotas.id)),
    db.select().from(pagos).orderBy(asc(pagos.id)),
    db.select().from(tiposCambio).orderBy(asc(tiposCambio.id)),
    db.select().from(indicesCac).orderBy(asc(indicesCac.id)),
    db.select().from(auditLog).orderBy(asc(auditLog.id)),
    db.select().from(user).orderBy(asc(user.id)),
  ]);

  const tables = {
    parcelas: parcelasRows,
    reservas: reservasRows,
    leads: leadsRows,
    contratos: contratosRows,
    cuotas: cuotasRows,
    pagos: pagosRows,
    tipos_cambio: tiposCambioRows,
    indices_cac: indicesCacRows,
    audit_log: auditLogRows,
    user: userRows,
  };

  const createdAt = new Date().toISOString();
  const data = {
    manifest: {
      createdAt,
      tables: Object.fromEntries(
        Object.entries(tables).map(([name, rows]) => [name, { rowCount: rows.length }])
      ),
    },
    tables,
  };

  return {
    createdAt,
    filename: `crm-db-backup-${createdAt.replace(/[:.]/g, "-")}.json.gz`,
    manifest: data.manifest,
    buffer: gzipSync(Buffer.from(JSON.stringify(data, null, 2), "utf8")),
  };
}
