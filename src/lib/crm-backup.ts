import { gzipSync } from "node:zlib";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, parcelas, reservas } from "@/lib/schema";

export async function createCrmBackup() {
  const [parcelasRows, reservasRows, leadsRows] = await Promise.all([
    db.select().from(parcelas).orderBy(asc(parcelas.id)),
    db.select().from(reservas).orderBy(asc(reservas.id)),
    db.select().from(leads).orderBy(asc(leads.id)),
  ]);

  const createdAt = new Date().toISOString();
  const data = {
    manifest: {
      createdAt,
      tables: {
        parcelas: { rowCount: parcelasRows.length },
        reservas: { rowCount: reservasRows.length },
        leads: { rowCount: leadsRows.length },
      },
    },
    tables: {
      parcelas: parcelasRows,
      reservas: reservasRows,
      leads: leadsRows,
    },
  };

  return {
    createdAt,
    filename: `crm-db-backup-${createdAt.replace(/[:.]/g, "-")}.json.gz`,
    manifest: data.manifest,
    buffer: gzipSync(Buffer.from(JSON.stringify(data, null, 2), "utf8")),
  };
}
