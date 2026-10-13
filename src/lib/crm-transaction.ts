import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type CrmTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function crmTransaction<T>(work: (tx: CrmTransaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    // Serializa las escrituras relacionadas para evitar saldos y estados de lecturas anteriores.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(731042)`);
    return work(tx);
  });
}
