import assert from "node:assert/strict";
import { formatMoneyAr, parseMoney } from "@/lib/money";
import { amountToSpanishWords } from "@/lib/number-words";

assert.equal(parseMoney("24959.84"), 24959.84);
assert.equal(parseMoney("24.959,84"), 24959.84);
assert.equal(parseMoney("24,959.84"), 24959.84);
assert.equal(parseMoney("3.500"), 3500);
assert.equal(parseMoney("447,08"), 447.08);
assert.equal(formatMoneyAr("24959.84"), "24.959,84");
assert.equal(formatMoneyAr("3500"), "3.500");
assert.equal(formatMoneyAr(""), "");
assert.equal(
  amountToSpanishWords(formatMoneyAr("24959.84")),
  "VEINTICUATRO MIL NOVECIENTOS CINCUENTA Y NUEVE CON 84/100"
);
