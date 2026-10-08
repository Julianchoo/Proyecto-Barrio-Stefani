import type { db } from "@/lib/db";
import { auditLog } from "@/lib/schema";
import type { AuditCambios } from "@/lib/schema";

// db o una transaccion: el registro se guarda junto con el cambio (si el cambio falla, no queda log).
type Executor = Pick<typeof db, "insert">;
type Row = Record<string, unknown> | null | undefined;

// Campos que cambian solos en cada guardado y no aportan al historial.
const IGNORED_FIELDS = new Set(["createdAt", "updatedAt", "modificadoPor"]);

function normalize(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

export function diffRows(antes: Row, despues: Row): AuditCambios {
  const cambios: AuditCambios = {};
  const keys = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})]);
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const before = normalize(antes?.[key]);
    const after = normalize(despues?.[key]);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      cambios[key] = { antes: before, despues: after };
    }
  }
  return cambios;
}

// Guarda que cambio entre dos versiones de una fila. antes = null es una creacion,
// despues = null una eliminacion. Si no cambio nada, no guarda nada.
export async function logAudit(
  executor: Executor,
  entry: {
    entidad: "lote" | "reserva" | "lead";
    entidadId: number;
    usuario: string;
    antes: Row;
    despues: Row;
  }
) {
  const cambios = diffRows(entry.antes, entry.despues);
  if (Object.keys(cambios).length === 0) return;
  await executor.insert(auditLog).values({
    entidad: entry.entidad,
    entidadId: entry.entidadId,
    accion: !entry.antes ? "crear" : !entry.despues ? "eliminar" : "editar",
    usuario: entry.usuario,
    cambios,
  });
}
