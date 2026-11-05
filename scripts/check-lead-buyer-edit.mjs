import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Run with node scripts/check-lead-buyer-edit.mjs. No database access.
const require = createRequire(import.meta.url);
function load(path, stubs = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  runInNewContext(source, {
    exports,
    require: (name) => stubs[name] ?? require(name),
    Date,
    URL,
  });
  return exports;
}
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { CompradorReservaComparison } = load("src/components/crm/comprador-reserva-comparison.tsx", {
  "@/lib/reservas-ui": load("src/lib/reservas-ui.ts"),
});
const savedBuyer = { nombreComprador: "Comprador", emailComprador: "viejo@example.test" };
const comparison = renderToStaticMarkup(
  createElement(CompradorReservaComparison, {
    guardado: savedBuyer,
    actual: { ...savedBuyer, emailComprador: "actual@example.test" },
    leadId: 1,
  })
);
assert.ok(comparison.includes("1 diferencia"));
assert.doesNotMatch(comparison, /<details[^>]*\sopen[\s=>]/);
assert.ok(comparison.includes("viejo@example.test") && comparison.includes("actual@example.test"));
assert.ok(comparison.includes("No hay una fecha de captura registrada"));
const emptyCopy = renderToStaticMarkup(
  createElement(CompradorReservaComparison, {
    guardado: null,
    actual: savedBuyer,
    leadId: 1,
  })
);
assert.ok(emptyCopy.includes("no tiene una copia guardada"));
const withoutLead = renderToStaticMarkup(
  createElement(CompradorReservaComparison, {
    guardado: savedBuyer,
    actual: savedBuyer,
    leadId: null,
  })
);
assert.ok(withoutLead.includes("no tiene un lead vinculado"));
const schema = load("src/lib/schema.ts");
const reservasLib = load("src/lib/reservas.ts", { "@/lib/schema": schema });
for (const estado of ["activa", "realizada", "cancelada", "vencida"]) {
  const lead = { nombre: "Actual", email: "actual@example.test", domicilio: null };
  const reserva = {
    estado,
    nombreComprador: "Viejo",
    emailComprador: "viejo@example.test",
    domicilioComprador: "Viejo",
  };
  const actual = reservasLib.flattenParcelaReserva({}, reserva, lead);
  assert.equal(actual.nombreComprador, lead.nombre);
  assert.equal(actual.emailComprador, lead.email);
  assert.equal(actual.domicilioComprador, null);
  const saved = reservasLib.compradorGuardado(reserva);
  assert.equal(saved.emailComprador, "viejo@example.test");
  assert.equal(saved.domicilioComprador, "Viejo");
  assert.equal(
    reservasLib.flattenParcelaReserva({}, reserva, lead).emailComprador,
    "actual@example.test"
  );
  assert.equal(
    reservasLib.flattenParcelaReserva({}, reserva, null).emailComprador,
    reserva.emailComprador
  );
}
async function edit(data, options = {}) {
  const current = {
    id: 41,
    nombre: "Rodrigo",
    email: "old@example.test",
    telefono: "123",
    dniCuit: "12345678",
    domicilio: "Original",
    nacionalidad: null,
    fechaNacimiento: null,
    estadoCivil: null,
    cuitComprador: null,
    asignadoA: "seller",
    estado: "closed_won",
  };
  const linked = options.unlinked
    ? []
    : [
        {
          id: 11,
          leadId: 41,
          estado: options.active ? "activa" : "realizada",
          ...reservasLib.compradorDesdeLead(current),
          domicilioComprador: "Histórico",
          cantidadCuotas: "72",
          cuotaMensual: "251",
          parcelaId: 5,
        },
        { id: 12, leadId: 41, estado: "activa", ...reservasLib.compradorDesdeLead(current) },
      ];
  let stored = { lead: { ...current }, reservas: structuredClone(linked), audits: [] };
  const writes = [];
  let reads = 0;
  const tx = {
    select: () => ({ from: () => ({ where: async () => (reads++ === 0 ? [current] : linked) }) }),
    update: (table) => ({
      set: (values) => ({
        where: () => ({
          returning: async () => {
            writes.push({ table, values });
            if (table === schema.leads) {
              stored.lead = { ...stored.lead, ...values };
              return [stored.lead];
            }
            assert.fail("Editar el lead no debe escribir en reservas");
          },
        }),
      }),
    }),
  };
  const route = load("src/app/api/crm/leads/[id]/route.ts", {
    "@/lib/schema": schema,
    "@/lib/reservas": reservasLib,
    "@/lib/validation-message": { validationMessage: () => "Invalid input" },
    "@/lib/api-auth": {
      requireApiAuth: async () => ({
        role: options.seller ? "comercial" : "admin",
        id: "seller",
        email: "admin@example.test",
      }),
      isErrorResponse: (value) => value instanceof Response,
    },
    "@/lib/crm-transaction": {
      crmTransaction: async (work) => {
        const before = structuredClone(stored);
        try {
          return await work(tx);
        } catch (error) {
          stored = before;
          throw error;
        }
      },
    },
    "@/lib/audit": {
      logAudit: async (_tx, entry) => {
        assert.equal(_tx, tx);
        if (options.failAudit) throw new Error("audit failed");
        stored.audits.push(entry);
      },
    },
  });
  const response = await route.PUT(
    new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    { params: Promise.resolve({ id: "41" }) }
  );
  return { response, stored, writes, current, linked };
}

let result = await edit({ email: "new@example.test" });
assert.equal(result.response.status, 409);
assert.equal(result.writes.length, 0);
assert.equal((await result.response.json()).reservas.length, 2);
for (const active of [true, false]) {
  result = await edit(
    { email: "new@example.test", confirmarEdicionReservas: true },
    { seller: true, active }
  );
  assert.equal(result.response.status, 403);
  assert.equal(result.writes.length, 0);
}
result = await edit({ email: "new@example.test", confirmarEdicionReservas: true });
assert.equal(result.response.status, 200);
assert.equal(result.stored.lead.email, "new@example.test");
assert.equal(result.stored.audits.length, 1);
assert.equal(result.writes.length, 1);
assert.deepEqual(result.stored.reservas, result.linked);
assert.equal("confirmarEdicionReservas" in result.writes[0].values, false);
for (const reserva of result.stored.reservas) {
  assert.equal(reserva.emailComprador, "old@example.test");
  assert.equal(
    reservasLib.flattenParcelaReserva({}, reserva, result.stored.lead).emailComprador,
    "new@example.test"
  );
}
assert.equal(result.stored.reservas[0].estado, "realizada");
assert.equal(result.stored.reservas[0].domicilioComprador, "Histórico");
assert.equal(result.stored.reservas[0].cantidadCuotas, "72");
assert.equal(result.stored.reservas[0].cuotaMensual, "251");
result = await edit({
  nombre: "Nombre corregido",
  telefono: "456",
  dniCuit: null,
  domicilio: "Nuevo",
  nacionalidad: "Argentina",
  fechaNacimiento: "1990-01-01",
  estadoCivil: "Soltero",
  cuitComprador: "20123456789",
  confirmarEdicionReservas: true,
});
assert.equal(result.response.status, 200);
for (const reserva of result.stored.reservas) {
  const actual = reservasLib.flattenParcelaReserva({}, reserva, result.stored.lead);
  for (const [field, value] of Object.entries(reservasLib.compradorDesdeLead(result.stored.lead))) {
    assert.equal(actual[field], value, field);
  }
}
result = await edit({ notas: "Seguimiento" });
assert.equal(result.response.status, 200);
assert.equal(result.writes.length, 1);
result = await edit({ email: "new@example.test" }, { unlinked: true, seller: true });
assert.equal(result.response.status, 200);
result = await edit({ email: "invalid" });
assert.equal(result.response.status, 400);
assert.equal(result.writes.length, 0);
result = await edit(
  { email: "new@example.test", confirmarEdicionReservas: true },
  { failAudit: true }
);
assert.equal(result.response.status, 500);
assert.equal(result.stored.lead.email, result.current.email);
assert.equal(result.stored.reservas[0].emailComprador, result.linked[0].emailComprador);
assert.equal(result.stored.audits.length, 0);
for (const role of ["admin", "comercial", "socio"]) {
  const row = { id: 30, nombreComprador: "Actual", compradorGuardado: savedBuyer };
  const list = load("src/app/api/crm/reservas/route.ts", {
    "@/lib/api-auth": {
      requireApiAuth: async () => ({ role }),
      isErrorResponse: (value) => value instanceof Response,
    },
    "@/lib/reservas-report": { getFilteredReservas: async () => [row] },
  });
  const response = await list.GET(new Request("http://localhost/api/crm/reservas"));
  assert.equal(response.status, 200);
  const [body] = await response.json();
  assert.equal("compradorGuardado" in body, role === "admin");
  assert.equal(body.nombreComprador, "Actual");
  assert.equal(row.compradorGuardado.emailComprador, savedBuyer.emailComprador);
}
console.log(
  "Lead buyer source: all states, empty fields, historical fallback, confirmation, permissions, collapsed comparison, admin-only copy, no reservation writes, audit and rollback checks passed"
);
