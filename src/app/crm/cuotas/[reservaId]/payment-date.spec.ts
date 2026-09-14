import assert from "node:assert/strict";
import { parsePaymentDate } from "@/app/crm/cuotas/[reservaId]/payment-date";

assert.equal(parsePaymentDate("04/05/2026"), "2026-05-04");
assert.equal(parsePaymentDate("25/12/2026"), "2026-12-25");
assert.equal(parsePaymentDate("29/02/2024"), "2024-02-29");
for (const invalid of ["29/02/2026", "31/04/2026", "12/25/2026", "", "4/5/2026"]) {
  assert.equal(parsePaymentDate(invalid), null);
}
for (const saved of ["2026-01-02", "2026-02-01", "2024-02-29"]) {
  assert.equal(parsePaymentDate(saved.split("-").reverse().join("/")), saved);
}
