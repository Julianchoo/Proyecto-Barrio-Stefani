import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Run with: node scripts/check-payment-edit.mjs. No database or storage access.
const require = createRequire(import.meta.url);
const source = ts.transpileModule(
  readFileSync(new URL("../src/app/api/crm/pagos/[id]/route.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;
async function edit(fields = {}, options = {}) {
  const current = {
    id: 1,
    cuotaId: 2,
    contratoId: 3,
    estado: "activo",
    moneda: "ars",
    monto: "100",
    fechaPago: "2026-09-01",
    tipoCambioAplicado: "10",
    montoUsd: "10",
    comprobanteUrl: "old.pdf",
    ...options.current,
  };
  const reads = [
    [current],
    [current],
    [{ estado: "pagada", importeAjustado: "150", ...options.cuota }],
    [{ monto: "50" }],
  ];
  let update,
    recomputed = false,
    deleted = false,
    lookedUp = false;
  const tx = {
    execute: async () => {},
    select: () => ({ from: () => ({ where: async () => reads.shift() }) }),
    update: () => ({
      set: (value) => {
        update = value;
        return {
          where: () => ({
            returning: async () => {
              if (options.failWrite) throw new Error("write failed");
              return [{ ...current, ...value }];
            },
          }),
        };
      },
    }),
  };
  const stubs = {
    "@/lib/api-auth": {
      requireApiAdmin: async () =>
        options.denied ? Response.json({}, { status: 403 }) : { email: "admin" },
      isErrorResponse: (value) => value instanceof Response,
    },
    "@/lib/db": { db: { transaction: async (fn) => fn(tx) } },
    "@/lib/schema": { pagos: { id: "id" }, cuotas: { id: "id" } },
    "@/lib/cuenta-corriente": {
      recomputeContratoCuotas: async () => {
        recomputed = true;
      },
    },
    "@/lib/tipos-cambio": {
      getTipoCambioOnOrBefore: async () => {
        lookedUp = true;
        return options.missingRate ? null : { valor: "20" };
      },
    },
    "@/lib/storage": {
      upload: async () => ({ url: "new.pdf", pathname: "new.pdf" }),
      deleteFile: async () => {
        deleted = true;
      },
    },
  };
  const exports = {};
  runInNewContext(source, {
    exports,
    require: (name) => stubs[name] ?? require(name),
    File,
    Buffer,
    Date,
  });
  const body = new FormData();
  for (const [key, value] of Object.entries({
    fechaPago: current.fechaPago,
    monto: current.monto,
    moneda: current.moneda,
    ...fields,
  }))
    body.set(key, value);
  let response;
  try {
    response = await exports.PATCH(new Request("http://localhost", { method: "PATCH", body }), {
      params: Promise.resolve({ id: "1" }),
    });
  } catch (error) {
    if (!options.failWrite) throw error;
    assert.equal(error.message, "write failed");
  }
  return { response, update, recomputed, deleted, lookedUp };
}
let result = await edit({ medio: "Efectivo", observacion: "Corregido" });
assert.equal(result.response.status, 200);
assert.equal(result.update.observacion, "Corregido");
assert.equal("comprobanteUrl" in result.update, false);
assert.equal("montoUsd" in result.update, false);
assert.equal(result.recomputed, false);
assert.equal(result.lookedUp, false);
result = await edit({ monto: "90" });
assert.equal(result.response.status, 200);
assert.equal(result.update.montoUsd, "9");
assert.equal(result.recomputed, true);
assert.equal((await edit({ monto: "101" })).response.status, 409);
assert.equal((await edit({ monto: "0" })).response.status, 400);
assert.equal((await edit({ fechaPago: "2026-02-30" })).response.status, 400);
assert.equal((await edit({ moneda: "usd" })).response.status, 409);
assert.equal((await edit({}, { denied: true })).response.status, 403);
assert.equal((await edit({}, { current: { estado: "anulado" } })).response.status, 409);
assert.equal(
  (await edit({ monto: "90" }, { cuota: { estado: "pendiente_indice" } })).response.status,
  409
);
result = await edit({ fechaPago: "2026-09-02" });
assert.equal(result.update.montoUsd, "5");
assert.equal(result.update.tipoCambioAplicado, "20");
result = await edit({ fechaPago: "2026-09-02" }, { missingRate: true });
assert.equal(result.update.montoUsd, null);
assert.equal((await edit({ quitarComprobante: "true" })).update.comprobanteUrl, null);
const file = new File(["receipt"], "receipt.pdf", { type: "application/pdf" });
result = await edit({ comprobante: file });
assert.equal(result.update.comprobanteUrl, "new.pdf");
assert.equal(result.deleted, false);
assert.equal((await edit({ comprobante: file }, { failWrite: true })).deleted, true);
assert.equal(
  (await edit({ comprobante: new File(["x"], "x.exe", { type: "application/octet-stream" }) }))
    .response.status,
  400
);
process.stdout.write("Payment edit checks passed.\n");
