// Baja de ARBA las parcelas de las manzanas que ya están en src/lib/arba-parcelas.json
// (más las que se pasen como argumento) y reescribe la copia que usa el mapa.
// Uso: pnpm run arba:actualizar [manzana ...]
import { writeFileSync } from "node:fs";
import { consultarArba, manzanaDeParcela, type ParcelaArba } from "../src/lib/arba";
import parcelasGuardadas from "../src/lib/arba-parcelas.json";

const manzanas = [
  ...new Set([
    ...(parcelasGuardadas.features as ParcelaArba[]).map(manzanaDeParcela),
    ...process.argv.slice(2).map((manzana) => String(Number(manzana))),
  ]),
].sort((a, b) => Number(a) - Number(b));

async function main() {
  const parcelas = await consultarArba(manzanas);
  writeFileSync(
    "src/lib/arba-parcelas.json",
    JSON.stringify({ type: "FeatureCollection", features: parcelas })
  );

  const porManzana = Object.groupBy(parcelas, manzanaDeParcela);
  for (const manzana of manzanas) {
    console.log(`Manzana ${manzana}: ${porManzana[manzana]?.length ?? 0} parcelas`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
