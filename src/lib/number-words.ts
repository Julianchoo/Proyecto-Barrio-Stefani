const UNITS = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
];

const TENS_SPECIAL: Record<number, string> = {
  10: "DIEZ",
  11: "ONCE",
  12: "DOCE",
  13: "TRECE",
  14: "CATORCE",
  15: "QUINCE",
  16: "DIECISEIS",
  17: "DIECISIETE",
  18: "DIECIOCHO",
  19: "DIECINUEVE",
  20: "VEINTE",
  21: "VEINTIUNO",
  22: "VEINTIDOS",
  23: "VEINTITRES",
  24: "VEINTICUATRO",
  25: "VEINTICINCO",
  26: "VEINTISEIS",
  27: "VEINTISIETE",
  28: "VEINTIOCHO",
  29: "VEINTINUEVE",
};

const TENS: Record<number, string> = {
  30: "TREINTA",
  40: "CUARENTA",
  50: "CINCUENTA",
  60: "SESENTA",
  70: "SETENTA",
  80: "OCHENTA",
  90: "NOVENTA",
};

const HUNDREDS: Record<number, string> = {
  100: "CIEN",
  200: "DOSCIENTOS",
  300: "TRESCIENTOS",
  400: "CUATROCIENTOS",
  500: "QUINIENTOS",
  600: "SEISCIENTOS",
  700: "SETECIENTOS",
  800: "OCHOCIENTOS",
  900: "NOVECIENTOS",
};

function parseAmountInteger(value: string): number | null {
  const trimmed = value.trim().replace(/\s+/g, "");
  if (!trimmed) return null;

  const numeric = trimmed.replace(/[^\d.,-]/g, "");
  if (!numeric || numeric === "-") return null;

  const isNegative = numeric.startsWith("-");
  const unsigned = numeric.replace(/-/g, "");
  const lastDot = unsigned.lastIndexOf(".");
  const lastComma = unsigned.lastIndexOf(",");

  let integerPart = unsigned;
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    integerPart = unsigned.slice(0, unsigned.lastIndexOf(decimalSeparator));
  } else {
    const separator = lastDot !== -1 ? "." : lastComma !== -1 ? "," : "";
    if (separator) {
      const parts = unsigned.split(separator);
      const lastPart = parts[parts.length - 1] ?? "";
      integerPart = lastPart.length === 3 ? parts.join("") : parts[0] ?? "";
    }
  }

  const normalized = integerPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(normalized)) return null;

  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount)) return null;

  return isNegative ? -amount : amount;
}

function convertTens(value: number): string {
  if (value < 10) return UNITS[value] ?? "";
  if (value < 30) return TENS_SPECIAL[value] ?? "";

  const ten = Math.floor(value / 10) * 10;
  const unit = value % 10;
  const tenText = TENS[ten] ?? "";

  return unit === 0 ? tenText : `${tenText} Y ${UNITS[unit]}`;
}

function convertHundreds(value: number): string {
  if (value === 0) return "";
  if (value < 100) return convertTens(value);
  if (value === 100) return HUNDREDS[100] ?? "CIEN";

  const hundred = Math.floor(value / 100) * 100;
  const rest = value % 100;
  const hundredText = hundred === 100 ? "CIENTO" : (HUNDREDS[hundred] ?? "");

  return rest === 0 ? hundredText : `${hundredText} ${convertTens(rest)}`;
}

function apocopateOne(value: string): string {
  return value
    .replace(/VEINTIUNO$/, "VEINTIUN")
    .replace(/ Y UNO$/, " Y UN")
    .replace(/UNO$/, "UN");
}

function convertInteger(value: number): string {
  if (value === 0) return "CERO";
  if (value < 0) return `MENOS ${convertInteger(Math.abs(value))}`;
  if (value < 1000) return convertHundreds(value);

  if (value < 1_000_000) {
    const thousands = Math.floor(value / 1000);
    const rest = value % 1000;
    const thousandsText = thousands === 1 ? "MIL" : `${apocopateOne(convertInteger(thousands))} MIL`;
    return rest === 0 ? thousandsText : `${thousandsText} ${convertHundreds(rest)}`;
  }

  const millions = Math.floor(value / 1_000_000);
  const rest = value % 1_000_000;
  const millionsText = millions === 1 ? "UN MILLON" : `${apocopateOne(convertInteger(millions))} MILLONES`;
  return rest === 0 ? millionsText : `${millionsText} ${convertInteger(rest)}`;
}

export function amountToSpanishWords(value: string | number | null | undefined): string | null {
  if (value == null) return null;

  const amount = parseAmountInteger(String(value));
  if (amount === null) return null;

  return convertInteger(amount);
}
