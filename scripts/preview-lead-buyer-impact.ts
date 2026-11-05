import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";
import { compradorDesdeLead, flattenParcelaReserva } from "@/lib/reservas";
import { leads, parcelas, reservas } from "@/lib/schema";

// SELECT únicamente. No cambia la conexión de la app ni guarda credenciales.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const production = process.argv.includes("--production");
const environment = production ? "production" : "dev";
const connection = process.env[production ? "PROD_POSTGRES_URL" : "POSTGRES_URL"];
assert.ok(connection, `Falta la conexión de ${environment}`);
const hostname = new URL(connection).hostname;
assert.ok(hostname.startsWith(production ? "ep-wandering-lake-" : "ep-fragrant-dust-"));
const client = postgres(connection, { max: 1, connect_timeout: 10 });
const fields = Object.keys(compradorDesdeLead({} as typeof leads.$inferSelect)) as Array<
  keyof ReturnType<typeof compradorDesdeLead>
>;
const generatedAt = new Date();
function camelRow<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase()),
      value,
    ])
  ) as T;
}

async function main() {
  try {
    const report = await client.begin("isolation level repeatable read read only", async (tx) => {
      const [mode] = await tx`show transaction_read_only`;
      assert.equal(mode!.transaction_read_only, "on");
      await tx`set local statement_timeout = '30s'`;
      const raw =
        await tx`select row_to_json(r) as reserva, row_to_json(p) as parcela, row_to_json(l) as lead
      from reservas r inner join parcelas p on p.id=r.parcela_id
      left join leads l on l.id=r.lead_id order by r.id`;
      const rows = raw.map((row) => ({
        reserva: camelRow<typeof reservas.$inferSelect>(row.reserva),
        parcela: camelRow<typeof parcelas.$inferSelect>(row.parcela),
        lead: row.lead ? camelRow<typeof leads.$inferSelect>(row.lead) : null,
      }));
      const [count] = await tx`select count(*)::int as total from reservas`;
      assert.ok(count);
      assert.equal(rows.length, count.total);
      const details = rows.map(({ reserva, parcela, lead }) => {
        const proposed = flattenParcelaReserva(parcela, reserva, lead);
        const current =
          lead && !(reserva.estado === "realizada" && reserva.nombreComprador)
            ? compradorDesdeLead(lead)
            : reserva;
        const differences = (before: typeof current) =>
          fields
            .filter((field) => before[field] !== proposed[field])
            .map((field) => ({
              field,
              before: before[field],
              after: proposed[field],
              losesValue: Boolean(before[field]) && !proposed[field],
            }));
        return {
          reservaId: reserva.id,
          estado: reserva.estado,
          leadId: reserva.leadId,
          comprador: proposed.nombreComprador,
          lote: parcela.numero,
          manzana: parcela.manzana,
          parcela: parcela.parcela,
          currentSource: current === reserva ? "reserva" : "lead",
          visibleChanges: differences(current),
          storedCopyDifferences: differences(reserva),
        };
      });
      return {
        environment,
        hostname,
        generatedAt: generatedAt.toISOString(),
        readOnly: true,
        total: rows.length,
        withoutLead: rows.filter((row) => !row.lead).map((row) => row.reserva.id),
        visibleChanges: details.filter((row) => row.visibleChanges.length),
        storedCopyDifferences: details.filter((row) => row.storedCopyDifferences.length),
      };
    });
    const folder = path.resolve(".cache/crm-safety");
    mkdirSync(folder, { recursive: true });
    const basename = path.join(folder, `lead-buyer-impact-${environment}-${generatedAt.getTime()}`);
    writeFileSync(`${basename}.json`, JSON.stringify(report, null, 2));
    const cell = (value: unknown) =>
      value === null || value === undefined || value === ""
        ? "(sin dato)"
        : String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
    const table = (
      rows: typeof report.visibleChanges,
      field: "visibleChanges" | "storedCopyDifferences"
    ) =>
      [
        "| Reserva | Estado | Lote | Comprador / Lead | Campo | Antes | Desde lead | Queda vacío |",
        "|---|---|---|---|---|---|---|---|",
        ...rows.flatMap((row) =>
          row[field].map(
            (change) =>
              `| #${row.reservaId} | ${row.estado} | ${cell(row.manzana)}-${cell(row.parcela)} (Nº ${row.lote}) | ${cell(row.comprador)} / #${row.leadId} | ${change.field} | ${cell(change.before)} | ${cell(change.after)} | ${change.losesValue ? "SÍ" : ""} |`
          )
        ),
      ].join("\n");
    const losses = report.visibleChanges.filter((row) =>
      row.visibleChanges.some((change) => change.losesValue)
    );
    writeFileSync(
      `${basename}.md`,
      [
        "# Impacto de usar el lead como fuente del comprador",
        `Fecha: ${generatedAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} (Argentina).`,
        `Base: ${environment}, ${hostname}. Transacción de solo lectura; sin UPDATE, INSERT ni DELETE.`,
        `Reservas revisadas: ${report.total}. Sin lead (IDs): ${report.withoutLead.map((id) => `#${id}`).join(", ") || "ninguna"}.`,
        `Cambiarían datos visibles en ${report.visibleChanges.length} reservas; ${losses.length} quedarían con algún dato vacío.`,
        "## Cambios visibles en listados, cuotas y exportaciones",
        "Antes = regla actual del sistema: usa la reserva realizada si tiene nombre guardado; en los demás casos, el lead. Después = lead si existe, sin completar vacíos con valores antiguos.",
        table(report.visibleChanges, "visibleChanges"),
        "## Diferencias contra la copia guardada en reservas",
        "Esta tabla también alcanza lecturas directas de la reserva (API individual y nombres en auditoría). No implica que todos esos valores se muestren hoy: varios ya vienen del lead. Las columnas almacenadas se conservan; no hay migración ni backfill.",
        table(report.storedCopyDifferences, "storedCopyDifferences"),
        "Este informe es una foto de la consulta. Debe regenerarse antes de desplegar si se modifican datos. Los documentos ya descargados no se actualizan.",
      ].join("\n\n")
    );
    console.log(
      JSON.stringify(
        {
          environment,
          readOnly: true,
          total: report.total,
          visibleChanges: report.visibleChanges.map((row) => ({
            id: row.reservaId,
            estado: row.estado,
            comprador: row.comprador,
            fields: row.visibleChanges.map((change) => change.field),
            losesValue: row.visibleChanges
              .filter((change) => change.losesValue)
              .map((change) => change.field),
          })),
          storedCopyDifferences: report.storedCopyDifferences.length,
          withoutLead: report.withoutLead,
          report: `${basename}.md`,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
