import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Run with pnpm exec tsx src/lib/crm-integrity.spec.ts. Uses only the disposable local test database.
async function main() {
  process.env.POSTGRES_URL = "postgres://postgres@127.0.0.1:55437/barrio_crm_test";
  const { db } = await import("@/lib/db");
  const schema = await import("@/lib/schema");
  const { sql, eq } = await import("drizzle-orm");
  const cuenta = await import("@/lib/cuenta-corriente");
  const transactions = await import("@/lib/crm-transaction");
  const tiposCambio = await import("@/lib/tipos-cambio");
  const reservasLib = await import("@/lib/reservas");
  const audit = await import("@/lib/audit");
  const require = createRequire(import.meta.url);
  let role = "admin";
  const auth = {
    requireApiAuth: async () => ({ id: "test-user", email: "test@example.test", role }),
    requireApiAdmin: async () =>
      role === "admin"
        ? { id: "test-user", email: "test@example.test", role }
        : Response.json({}, { status: 403 }),
    isErrorResponse: (value: unknown) => value instanceof Response,
  };
  function route(path: string, overrides = {}) {
    const stubs: Record<string, unknown> = {
      "@/lib/db": { db },
      "@/lib/schema": schema,
      "@/lib/api-auth": auth,
      "@/lib/crm-transaction": transactions,
      "@/lib/cuenta-corriente": cuenta,
      "@/lib/tipos-cambio": tiposCambio,
      "@/lib/reservas": reservasLib,
      "@/lib/audit": audit,
      "@/lib/storage": {
        upload: () => {
          throw new Error("Unexpected storage call");
        },
      },
      ...overrides,
    };
    const source = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const exports: Record<string, (request: Request, params: unknown) => Promise<Response>> = {};
    runInNewContext(source, {
      exports,
      require: (name: string) => stubs[name] ?? require(name),
      File,
      Request,
      Response,
      Buffer,
      Date,
      process,
      console,
    });
    return exports;
  }
  const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
  const json = (body: unknown) =>
    new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const payment = (monto: number, moneda = "usd") => {
    const body = new FormData();
    body.set("fechaPago", "2026-10-01");
    body.set("monto", String(monto));
    body.set("moneda", moneda);
    return new Request("http://localhost", { method: "POST", body });
  };
  const { parcelas, leads, reservas, contratos, cuotas, pagos, user, tiposCambio: rates } = schema;
  const [database] = await db.execute(sql`SELECT current_database() AS name`);
  assert.equal(database!.name, "barrio_crm_test");
  await db.execute(
    sql`TRUNCATE pagos, cuotas, contratos, reservas, leads, parcelas, audit_log, tipos_cambio, indices_cac, "user" CASCADE`
  );
  await db.insert(user).values({ id: "test-user", name: "Test", email: "test@example.test" });
  const [lead] = await db
    .insert(leads)
    .values({
      nombre: "Original",
      email: "buyer@example.test",
      telefono: "123",
      asignadoA: "test-user",
    })
    .returning();
  const [lot, otherLot, newLot] = await db
    .insert(parcelas)
    .values([
      { numero: 1, estado: "vendido" },
      { numero: 2, estado: "vendido" },
      { numero: 3, estado: "reservado" },
    ])
    .returning();
  const [reserva, invalid, pending] = await db
    .insert(reservas)
    .values([
      {
        parcelaId: lot!.id,
        leadId: lead!.id,
        estado: "realizada",
        formaPago: "financiado",
        modalidadContrato: "usd_fijo",
        cantidadCuotas: "2",
        cuotaMensual: "100",
        saldoNum: "200",
        fechaFirma: "2026-09-01",
        reservadoPor: "test@example.test",
      },
      {
        parcelaId: otherLot!.id,
        estado: "realizada",
        formaPago: "financiado",
        cantidadCuotas: "2",
        cuotaMensual: "-100",
        saldoNum: "200",
        fechaFirma: "2026-09-01",
      },
      {
        parcelaId: newLot!.id,
        leadId: lead!.id,
        estado: "activa",
        formaPago: "financiado",
        modalidadContrato: "usd_fijo",
        cantidadCuotas: "2",
        cuotaMensual: "100",
        saldoNum: "200",
        fechaFirma: "2026-09-01",
        reservadoPor: "test@example.test",
      },
    ])
    .returning();
  assert.equal(
    (await cuenta.createContratoForReserva(invalid!.id, { modalidad: "usd_fijo" }, "test")).kind,
    "invalid-data"
  );
  assert.equal((await db.select().from(contratos)).length, 0);
  const created = await Promise.all(
    [1, 2].map(() =>
      cuenta.createContratoForReserva(reserva!.id, { modalidad: "usd_fijo" }, "test")
    )
  );
  assert.deepEqual(created.map((item) => item.kind).sort(), ["exists", "ok"]);
  assert.equal((await db.select().from(contratos)).length, 1);
  assert.equal(
    (
      await cuenta.createContratoForReserva(
        reserva!.id,
        { modalidad: "usd_fijo", cuotaBase: -1 },
        "test"
      )
    ).kind,
    "exists"
  );
  const [cuota] = await db.select().from(cuotas).orderBy(cuotas.numero);
  const postPayment = route("src/app/api/crm/cuotas/[id]/pagos/route.ts").POST!;
  const responses = await Promise.all(
    [60, 40].map((amount) => postPayment(payment(amount), params(cuota!.id)))
  );
  assert.deepEqual(
    responses.map((response) => response.status),
    [201, 201]
  );
  let [current] = await db.select().from(cuotas).where(eq(cuotas.id, cuota!.id));
  assert.equal(Number(current!.saldo), 0);
  assert.equal(current!.estado, "pagada");
  assert.equal((await postPayment(payment(1), params(cuota!.id))).status, 409);
  const [secondCuota] = await db.select().from(cuotas).where(eq(cuotas.numero, 2));
  const failing = route("src/app/api/crm/cuotas/[id]/pagos/route.ts", {
    "@/lib/cuenta-corriente": {
      recomputeContratoCuotas: () => {
        throw new Error("Forced recompute failure");
      },
    },
  }).POST!;
  await assert.rejects(
    () => failing(payment(10), params(secondCuota!.id)),
    /Forced recompute failure/
  );
  assert.equal((await db.select().from(pagos).where(eq(pagos.cuotaId, secondCuota!.id))).length, 0);
  const patchCuota = route("src/app/api/crm/cuotas/[id]/route.ts").PATCH!;
  assert.equal((await patchCuota(json({ importeBase: 80 }), params(cuota!.id))).status, 409);
  [current] = await db.select().from(cuotas).where(eq(cuotas.id, cuota!.id));
  assert.equal(Number(current!.importeBase), 100);
  assert.equal(Number(current!.saldo), 0);
  const editPayment = route("src/app/api/crm/pagos/[id]/route.ts").PATCH!;
  const [firstPayment] = await db.select().from(pagos).where(eq(pagos.monto, "60"));
  assert.equal((await editPayment(payment(50), params(firstPayment!.id))).status, 200);
  assert.equal(Number((await db.select().from(cuotas).where(eq(cuotas.id, cuota!.id)))[0]!.saldo), 10);
  const editLead = route("src/app/api/crm/leads/[id]/route.ts");
  role = "comercial";
  assert.equal(
    (await editLead.PUT!(json({ nombre: "Unauthorized" }), params(lead!.id))).status,
    403
  );
  role = "admin";
  assert.equal((await editLead.DELETE!(json({}), params(lead!.id))).status, 409);
  const editLot = route("src/app/api/crm/parcelas/[id]/route.ts").PUT!;
  assert.equal(
    (await editLot(json({ cuotaMensual: "80", confirmarEdicionVendida: true }), params(lot!.id)))
      .status,
    409
  );
  assert.equal(
    (await editLot(json({ leadId: null, confirmarEdicionVendida: true }), params(lot!.id))).status,
    409
  );
  const [blockedLot] = await db
    .insert(parcelas)
    .values({ numero: 4, estado: "no_disponible" })
    .returning();
  const patchReserva = route("src/app/api/crm/reservas/[id]/route.ts").PATCH!;
  for (const nonAdmin of ["comercial", "socio"]) {
    role = nonAdmin;
    assert.equal((await editLot(json({ estado: "disponible" }), params(blockedLot!.id))).status, 403);
    assert.equal(
      (
        await patchReserva(
          json({ estado: "cancelada", confirmarCambioEstado: true }),
          params(reserva!.id)
        )
      ).status,
      403
    );
  }
  role = "admin";
  assert.equal((await editLot(json({ estado: "disponible" }), params(blockedLot!.id))).status, 200);
  assert.equal(
    (
      await patchReserva(
        json({ estado: "realizada", confirmarCambioEstado: true }),
        params(pending!.id)
      )
    ).status,
    200
  );
  const [snapshot] = await db.select().from(reservas).where(eq(reservas.id, pending!.id));
  assert.equal(snapshot!.nombreComprador, "Original");
  const boleto = route("src/app/api/crm/parcelas/[id]/boleto/route.ts").POST!;
  const beforeDocument = (await db.select().from(reservas).where(eq(reservas.id, pending!.id)))[0];
  const documentInput = { dia: "13", mes: "10", anio: "2026", nacionalidad: "Argentina", fechaNacimiento: "1990-01-01", estadoCivil: "Soltero", cuitComprador: "123", domicilioComprador: "Test", tipoPago: "financiado", monedaBoleto: "usd" };
  assert.equal((await boleto(json({ ...documentInput, cuotaMensual: "80" }), params(newLot!.id))).status, 409);
  assert.equal((await boleto(json(documentInput), params(newLot!.id))).status, 200);
  assert.deepEqual((await db.select().from(reservas).where(eq(reservas.id, pending!.id)))[0], beforeDocument);
  assert.equal((await editLead.PUT!(json({ nombre: "Updated" }), params(lead!.id))).status, 200);
  const [updatedLead] = await db.select().from(leads).where(eq(leads.id, lead!.id));
  assert.equal(
    reservasLib.flattenParcelaReserva(newLot!, snapshot!, updatedLead).nombreComprador,
    "Original"
  );
  await db.insert(rates).values({ fecha: tiposCambio.argentinaTodayKey(), valor: "1000" });
  assert.equal(
    (await cuenta.getCuentaCorrienteDetailByReserva(pending!.id))!.comprador,
    "Original"
  );
  const [raceLot] = await db
    .insert(parcelas)
    .values({ numero: 4, estado: "reservado" })
    .returning();
  const [raceReserva] = await db
    .insert(reservas)
    .values({ parcelaId: raceLot!.id, estado: "activa", formaPago: "contado" })
    .returning();
  await Promise.all(
    ["cancelada", "realizada"].map((estado) =>
      patchReserva(json({ estado, confirmarCambioEstado: true }), params(raceReserva!.id))
    )
  );
  const [raceFinal] = await db.select().from(reservas).where(eq(reservas.id, raceReserva!.id));
  const [raceLotFinal] = await db.select().from(parcelas).where(eq(parcelas.id, raceLot!.id));
  assert.equal(raceLotFinal!.estado, raceFinal!.estado === "realizada" ? "vendido" : "disponible");
  const [failureLot] = await db
    .insert(parcelas)
    .values({ numero: 5, estado: "reservado" })
    .returning();
  const [failureReserva] = await db
    .insert(reservas)
    .values({
      parcelaId: failureLot!.id,
      estado: "activa",
      formaPago: "financiado",
      modalidadContrato: "usd_fijo",
    })
    .returning();
  const failingTransition = route("src/app/api/crm/reservas/[id]/route.ts", {
    "@/lib/cuenta-corriente": {
      createContratoForReserva: () => {
        throw new Error("Forced contract failure");
      },
    },
  }).PATCH!;
  assert.equal(
    (
      await failingTransition(
        json({ estado: "realizada", confirmarCambioEstado: true }),
        params(failureReserva!.id)
      )
    ).status,
    500
  );
  assert.equal(
    (await db.select().from(reservas).where(eq(reservas.id, failureReserva!.id)))[0]!.estado,
    "activa"
  );
  assert.equal(
    (await db.select().from(parcelas).where(eq(parcelas.id, failureLot!.id)))[0]!.estado,
    "reservado"
  );
  const [ownLot, othersLot] = await db
    .insert(parcelas)
    .values([
      { numero: 6, estado: "reservado" },
      { numero: 7, estado: "reservado" },
    ])
    .returning();
  const [ownReserva, othersReserva] = await db
    .insert(reservas)
    .values([
      { parcelaId: ownLot!.id, estado: "activa", reservadoPor: "test@example.test" },
      { parcelaId: othersLot!.id, estado: "activa", reservadoPor: "other@example.test" },
    ])
    .returning();
  role = "comercial";
  const cancel = () => json({ estado: "cancelada", confirmarCambioEstado: true });
  assert.equal((await patchReserva(cancel(), params(othersReserva!.id))).status, 403);
  assert.equal(
    (await patchReserva(json({ estado: "realizada", confirmarCambioEstado: true }), params(ownReserva!.id)))
      .status,
    403
  );
  assert.equal((await patchReserva(cancel(), params(ownReserva!.id))).status, 200);
  assert.equal(
    (await db.select().from(parcelas).where(eq(parcelas.id, ownLot!.id)))[0]!.estado,
    "disponible"
  );
  role = "admin";
  await db.insert(rates).values({ fecha: "2026-09-01", valor: "10" });
  const [contract] = await db.select().from(contratos).where(eq(contratos.reservaId, reserva!.id));
  await db
    .insert(pagos)
    .values({
      contratoId: contract!.id,
      fechaPago: "2026-09-15",
      monto: "100",
      moneda: "ars",
      tipoCambioAplicado: "10",
      montoUsd: "10",
    });
  const preview = await tiposCambio.saveTipoCambioBna({
    fecha: "2026-09-01",
    valor: 20,
    creadoPor: "test",
  });
  assert.equal(preview.kind, "confirmation-required");
  assert.equal(
    Number((await db.select().from(rates).where(eq(rates.fecha, "2026-09-01")))[0]!.valor),
    10
  );
  if (preview.kind !== "confirmation-required") throw new Error("Expected preview");
  assert.equal(preview.impact.pagos, 1);
  const stale = await tiposCambio.saveTipoCambioBna({ fecha: "2026-09-01", valor: 30, creadoPor: "test", confirmarImpacto: preview.confirmation });
  assert.equal(stale.kind, "confirmation-required");
  assert.equal(
    (
      await tiposCambio.saveTipoCambioBna({
        fecha: "2026-09-01",
        valor: 20,
        creadoPor: "test",
        confirmarImpacto: preview.confirmation,
      })
    ).kind,
    "ok"
  );
  const [arsPayment] = await db.select().from(pagos).where(eq(pagos.moneda, "ars"));
  assert.equal(Number(arsPayment!.montoUsd), 5);
  await db
    .insert(pagos)
    .values({
      contratoId: contract!.id,
      fechaPago: "2026-10-13",
      monto: "100",
      moneda: "ars",
      tipoCambioAplicado: "999",
      montoUsd: "123",
    });
  const unrelated = await tiposCambio.saveTipoCambioBna({
    fecha: "2026-09-01",
    valor: 20,
    creadoPor: "test",
  });
  assert.equal(unrelated.kind, "ok");
  assert.equal(
    Number((await db.select().from(pagos).where(eq(pagos.fechaPago, "2026-10-13")))[0]!.montoUsd),
    123
  );
  role = "comercial";
  assert.equal(
    (
      await route("src/app/api/crm/tipos-cambio/route.ts").POST!(
        json({ fecha: "2026-09-01", valor: 30 }),
        {}
      )
    ).status,
    403
  );
  // Cancelar una cuenta corriente: no se borra, queda como historial congelado y libera la reserva.
  role = "admin";
  const blocked = await editLot(
    json({ cuotaMensual: "80", confirmarEdicionVendida: true }),
    params(lot!.id)
  );
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).cuentaCorrienteUrl, `/crm/cuotas/${reserva!.id}`);
  const leaveRealizada = await patchReserva(
    json({ estado: "activa", confirmarCambioEstado: true }),
    params(reserva!.id)
  );
  assert.equal(leaveRealizada.status, 409);
  assert.equal((await leaveRealizada.json()).cuentaCorrienteUrl, `/crm/cuotas/${reserva!.id}`);
  const cuentasCanceladas = route("src/app/api/crm/reservas/[id]/cuentas-canceladas/route.ts");
  assert.equal((await cuentasCanceladas.POST!(json({}), params(reserva!.id))).status, 200);
  assert.equal((await cuentasCanceladas.POST!(json({}), params(reserva!.id))).status, 404);
  const [cancelled] = await db.select().from(contratos).where(eq(contratos.id, contract!.id));
  assert.equal(cancelled!.estado, "cancelada");
  assert.equal(cancelled!.canceladoPor, "test@example.test");
  const keptPagos = await db.select().from(pagos).where(eq(pagos.contratoId, contract!.id));
  assert.ok(keptPagos.length > 0);
  assert.ok((await db.select().from(cuotas).where(eq(cuotas.contratoId, contract!.id))).length > 0);
  assert.equal((await postPayment(payment(1), params(secondCuota!.id))).status, 409);
  const deletePayment = route("src/app/api/crm/pagos/[id]/route.ts").DELETE!;
  assert.equal((await deletePayment(json({}), params(keptPagos[0]!.id))).status, 409);
  assert.equal(
    (await editLot(json({ cuotaMensual: "80", confirmarEdicionVendida: true }), params(lot!.id)))
      .status,
    200
  );
  const recreated = await cuenta.createContratoForReserva(
    reserva!.id,
    { modalidad: "usd_fijo" },
    "test"
  );
  assert.equal(recreated.kind, "ok");
  const vigente = await cuenta.getCuentaCorrienteDetailByReserva(reserva!.id);
  assert.notEqual(vigente!.contrato.id, contract!.id);
  assert.equal(Number(vigente!.contrato.cuotaBase), 80);
  const history = await cuenta.listCuentasCanceladas(reserva!.id);
  assert.deepEqual(
    history.map((item) => [item.contrato.id, item.pagos.length]),
    [[contract!.id, keptPagos.length]]
  );
  process.stdout.write(
    "CRM integrity checks passed: concurrency, rollback, new-contract validation, lead protection, immutable conditions, snapshot, TC confirmation, permissions and account cancellation.\n"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
