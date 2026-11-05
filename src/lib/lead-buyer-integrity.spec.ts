import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Solo la base descartable local; autenticación simulada, consultas y transacciones reales.
async function main() {
  process.env.POSTGRES_URL = "postgres://postgres@127.0.0.1:55437/barrio_crm_test";
  const { db } = await import("@/lib/db");
  const schema = await import("@/lib/schema");
  const { eq, sql } = await import("drizzle-orm");
  const transactions = await import("@/lib/crm-transaction");
  const helpers = await import("@/lib/reservas");
  const audit = await import("@/lib/audit");
  const reports = await import("@/lib/reservas-report");
  const require = createRequire(import.meta.url);
  let role = "admin";
  const auth = {
    requireApiAuth: async () => ({ id: "buyer-test", email: "admin@example.test", role }),
    isErrorResponse: (value: unknown) => value instanceof Response,
  };
  function route(file: string, overrides = {}) {
    const stubs: Record<string, unknown> = {
      "@/lib/db": { db },
      "@/lib/schema": schema,
      "@/lib/api-auth": auth,
      "@/lib/crm-transaction": transactions,
      "@/lib/reservas": helpers,
      "@/lib/audit": audit,
      "@/lib/reservas-report": reports,
      "@/lib/cuenta-corriente": { contratoVigente: eq(schema.contratos.estado, "vigente") },
      ...overrides,
    };
    const exports: Record<string, (request: Request, params?: unknown) => Promise<Response>> = {};
    runInNewContext(
      ts.transpileModule(readFileSync(file, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      { exports, require: (name: string) => stubs[name] ?? require(name), Date, URL }
    );
    return exports;
  }
  const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
  const json = (body: unknown) =>
    new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  const { leads, parcelas, reservas, user } = schema;
  const [database] = await db.execute(sql`select current_database() as name`);
  assert.equal(database!.name, "barrio_crm_test");
  await db.execute(
    sql`TRUNCATE pagos, cuotas, contratos, reservas, leads, parcelas, audit_log, tipos_cambio, indices_cac, "user" CASCADE`
  );
  await db.insert(user).values({ id: "buyer-test", name: "Test", email: "admin@example.test" });
  const [lead] = await db
    .insert(leads)
    .values({
      nombre: "Comprador original",
      email: "original@example.test",
      telefono: "123456",
      asignadoA: "buyer-test",
      dniCuit: "12345678",
      domicilio: "Domicilio original",
      nacionalidad: "Argentina",
      fechaNacimiento: "1990-01-01",
      estadoCivil: "Soltero",
      cuitComprador: "20123456789",
    })
    .returning();
  const [lot] = await db.insert(parcelas).values({ numero: 1, estado: "disponible" }).returning();
  const editLot = route("src/app/api/crm/parcelas/[id]/route.ts").PUT!;
  assert.equal(
    (await editLot(json({ leadId: lead!.id, formaPago: "contado" }), params(lot!.id))).status,
    200
  );
  const [created] = await db.select().from(reservas).where(eq(reservas.parcelaId, lot!.id));
  assert.deepEqual(helpers.compradorGuardado(created!), helpers.compradorDesdeLead(lead!));
  const editLead = route("src/app/api/crm/leads/[id]/route.ts").PUT!;
  assert.equal(
    (await editLead(json({ email: "nuevo@example.test" }), params(lead!.id))).status,
    409
  );
  assert.equal(
    (
      await editLead(
        json({ email: "nuevo@example.test", confirmarEdicionReservas: true }),
        params(lead!.id)
      )
    ).status,
    200
  );
  const [afterLead] = await db.select().from(reservas).where(eq(reservas.id, created!.id));
  assert.deepEqual(afterLead, created);
  const changeState = route("src/app/api/crm/reservas/[id]/route.ts").PATCH!;
  const formalized = await changeState(
    json({ estado: "realizada", confirmarCambioEstado: true }),
    params(created!.id)
  );
  assert.equal(formalized.status, 200, await formalized.text());
  const [saved] = await db.select().from(reservas).where(eq(reservas.id, created!.id));
  assert.equal(saved!.emailComprador, "nuevo@example.test");
  assert.equal(saved!.estado, "realizada");
  const [soldLot] = await db.select().from(parcelas).where(eq(parcelas.id, lot!.id));
  assert.equal(soldLot!.estado, "vendido");
  assert.equal(
    (
      await editLead(
        json({ email: "actual@example.test", domicilio: null, confirmarEdicionReservas: true }),
        params(lead!.id)
      )
    ).status,
    200
  );
  const [preserved] = await db.select().from(reservas).where(eq(reservas.id, saved!.id));
  assert.deepEqual(preserved, saved);
  const list = route("src/app/api/crm/reservas/route.ts").GET!;
  const adminRows = await (await list(new Request("http://localhost/api/crm/reservas"))).json();
  assert.equal(adminRows[0].emailComprador, "actual@example.test");
  assert.equal(adminRows[0].domicilioComprador, null);
  assert.equal(adminRows[0].compradorGuardado.emailComprador, "nuevo@example.test");
  assert.equal(adminRows[0].compradorGuardado.domicilioComprador, "Domicilio original");
  for (const nonAdmin of ["comercial", "socio"]) {
    role = nonAdmin;
    const rows = await (await list(new Request("http://localhost/api/crm/reservas"))).json();
    assert.equal(rows[0].emailComprador, "actual@example.test");
    assert.equal("compradorGuardado" in rows[0], false);
    assert.equal(
      (
        await editLead(
          json({ email: "prohibido@example.test", confirmarEdicionReservas: true }),
          params(lead!.id)
        )
      ).status,
      403
    );
  }
  role = "admin";
  const failedAudit = route("src/app/api/crm/leads/[id]/route.ts", {
    "@/lib/audit": {
      logAudit: () => {
        throw new Error("Forced audit failure");
      },
    },
  }).PUT!;
  assert.equal(
    (
      await failedAudit(
        json({ email: "rollback@example.test", confirmarEdicionReservas: true }),
        params(lead!.id)
      )
    ).status,
    500
  );
  const [unchanged] = await db.select().from(leads).where(eq(leads.id, lead!.id));
  assert.equal(unchanged!.email, "actual@example.test");
  console.log(
    "Buyer PostgreSQL integration passed: capture on creation/formalization, current lead reads, preserved copy, admin-only access, permissions and rollback"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
