#!/usr/bin/env node
/**
 * Build script: generates src/templates/boleto-template.docx
 * from the original BOLETO modelo, replacing placeholder patterns with {tag} syntax
 * compatible with docxtemplater.
 *
 * Run once: node scripts/build-boleto-template.js
 */

const PizZip = require("pizzip");
const fs = require("fs");
const path = require("path");

const BOLETO_PATH = path.join(
  __dirname,
  "../docs/business/generador_boleto/BOLETO - MODELO BARRIO STEFANI SA.docx"
);
const TEMPLATE_PATH = path.join(
  __dirname,
  "../src/templates/boleto-template.docx"
);

// Ordered list of highlighted placeholders (index matches occurrence order in doc).
// '__KEEP:text' means: remove highlight but keep original text (no placeholder).
const HIGHLIGHTED_TAGS = [
  "dia", //  0: [__] in "a los [__] días"
  "mes", //  1: [__] in "del mes de [__] de"
  "nacionalidad", //  2: [nacionalidad]
  "fechaNacimiento", //  3: [fecha de nacimiento]
  "estadoCivil", //  4: [estado civil]
  "dniComprador", //  5: [__] DNI
  "cuitComprador", //  6: [__] CUIT
  "domicilioComprador", //  7: [__] domicilio
  "tituloPlano", //  8: [Título/Plano]
  "lote", //  9: [__] in "LOTE [__]"
  "manzana", // 10: [__] in "MANZANA [__],"
  "medidas", // 11: [__] measurements/surface
  "manzanaCatastral", // 12: [__] in "Manzana [__], Parcela"
  "parcelaCatastral", // 13: [__] in "Parcela [__].-"
  "partida", // 14: [__] in "074-[__]"
  "escritura", // 15: [__] escritura number
  "fechaEscritura", // 16: [__] escritura date
  "folio", // 17: [__] folio
  "fechaInscripcion", // 18: [__] inscription date
  "__KEEP:CIENTO OCHENTA DÍAS", // 19: keep text, remove highlight
  "__KEEP: ", // 20: keep space, remove highlight
  "__KEEP:(180)", // 21: keep text, remove highlight
];

function processXml(xml) {
  let idx = 0;

  // ── Step 1: Replace highlighted runs ────────────────────────────────────────
  // Match: <w:r ...><w:rPr>...<w:highlight w:val="lightGray"/>...</w:rPr><w:t ...>TEXT</w:t></w:r>
  const hlRunRe =
    /(<w:r[^>]*>)(<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*?)<w:highlight[^\/]*\/>((?:(?!<\/w:rPr>)[\s\S])*?<\/w:rPr><w:t[^>]*>)([^<]+)(<\/w:t><\/w:r>)/g;

  // Callback args: (match, G1_openRun, G2_rPrBefore, G3_rPrAfterAndWtOpen, G4_originalText, G5_closeTags, offset, fullString)
  xml = xml.replace(
    hlRunRe,
    (match, openRun, rPrBefore, rPrAfter, originalText, closeTags) => {
      const tag = HIGHLIGHTED_TAGS[idx++];
      if (!tag) {
        console.warn(`Unexpected highlighted run #${idx - 1}: "${originalText}"`);
        return match; // keep as-is
      }
      if (tag.startsWith("__KEEP:")) {
        const keepText = tag.slice(7);
        // Remove highlight but keep original text
        return `${openRun}${rPrBefore}${rPrAfter}${keepText}${closeTags}`;
      }
      // Replace with {tag}, remove highlight
      return `${openRun}${rPrBefore}${rPrAfter}{${tag}}${closeTags}`;
    }
  );

  if (idx !== HIGHLIGHTED_TAGS.length) {
    console.warn(
      `Warning: expected ${HIGHLIGHTED_TAGS.length} highlighted runs, found ${idx}`
    );
  }

  // ── Step 2: Strip orphaned [ and ] around replaced placeholders ──────────────
  // Strip ] from the immediate start of any <w:t>
  xml = xml.replace(/(<w:t[^>]*>)\]/g, "$1");
  // Strip [ from the immediate end of any <w:t>
  xml = xml.replace(/\[(<\/w:t>)/g, "$1");

  // ── Step 3: Replace the hardcoded year ───────────────────────────────────────
  xml = xml.replace("de dos mil veintiséis, quienes", "de {anio}, quienes");

  // ── Step 4: Replace asterisk placeholders in document order ──────────────────
  // 0: ****** buyer name (bold)
  xml = xml.replace("******", "{nombreComprador}");
  // 1: ****** street name of property
  xml = xml.replace("******", "{calleInmueble}");
  // 2: *********** street boundaries
  xml = xml.replace("***********", "{limites}");
  // 3: ****** Matrícula (primera cláusula)
  xml = xml.replace("******", "{matricula}");
  // 4: " *****.-" Matrícula (segunda cláusula) - has leading space and trailing .-
  xml = xml.replace(" *****.-", " {matriculaSegunda}.-");
  // 5: **** total price in words (TERCERA)
  xml = xml.replace("****", "{precioTotalPalabras}");
  // 6: ****** total price number
  xml = xml.replace("******", "{precioTotalNum}");
  // 7: anticipo: both word and number appear in the same <w:t> node
  xml = xml.replace(
    "DÓLARES ESTADOUNIDENSES BILLETE ***** (U$S *****)",
    "DÓLARES ESTADOUNIDENSES BILLETE {anticipoPalabras} (U$S {anticipoNum})"
  );
  // 8: ***** saldo (balance) in words
  xml = xml.replace("*****", "{saldoPalabras}");
  // 9: **** saldo (balance) number
  xml = xml.replace("****", "{saldoNum}");

  // ── Step 5: Inject co-buyer conditional block ─────────────────────────────────
  // Insert {#hasCoComprador}...{/hasCoComprador} between domicilioComprador and
  // the text ", en adelante denominado".
  // We match the closing </w:t></w:r> of the domicilioComprador run, then the
  // next run that starts with ", en adelante".
  xml = xml.replace(
    /(\{domicilioComprador\}<\/w:t><\/w:r>)([\s\S]*?)(<w:t[^>]*>)(, en adelante denominado)/,
    (match, after, between, wtTag, enAdelante) => {
      const coCompTag =
        `{#hasCoComprador}, y {nombreCoComprador}, titular del DNI {dniCoComprador}, ` +
        `CUIT {cuitCoComprador}, {estadoCivilCoComprador}, ` +
        `adquiriendo el {porcentajeCoComprador}% de la compra{/hasCoComprador}`;
      return `${after}${between}${wtTag}${coCompTag}${enAdelante}`;
    }
  );

  // ── Step 6: Ensure xml:space="preserve" on text nodes with leading/trailing spaces ──
  // Without this, XML parsers strip surrounding whitespace from <w:t> elements,
  // which causes "LOTE62DE LA MANZANA3" instead of "LOTE 62 DE LA MANZANA 3".
  xml = xml.replace(/<w:t>(\s[^<]*|[^<]*\s)<\/w:t>/g, '<w:t xml:space="preserve">$1</w:t>');

  return xml;
}

// ── Main ──────────────────────────────────────────────────────────────────────
try {
  const buf = fs.readFileSync(BOLETO_PATH);
  const zip = new PizZip(buf);

  let xml = zip.file("word/document.xml").asText();
  xml = processXml(xml);
  zip.file("word/document.xml", xml);

  fs.mkdirSync(path.dirname(TEMPLATE_PATH), { recursive: true });
  fs.writeFileSync(TEMPLATE_PATH, zip.generate({ type: "nodebuffer" }));

  console.log("✓ Template built:", TEMPLATE_PATH);
} catch (err) {
  console.error("Error building template:", err);
  process.exit(1);
}
