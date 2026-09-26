export function parseMoney(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim().replace(/\s+/g, "");
  const cleaned = text.replace(/[^\d.,-]/g, "");
  if (!cleaned || cleaned === "-") return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized = cleaned;

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const thousandsSeparator = decimalSeparator === "." ? "," : ".";
    normalized = cleaned
      .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
      .replace(decimalSeparator, ".");
  } else {
    const separator = lastDot !== -1 ? "." : lastComma !== -1 ? "," : "";
    if (separator) {
      const parts = cleaned.split(separator);
      const lastPart = parts[parts.length - 1] ?? "";
      normalized = lastPart.length === 3
        ? parts.join("")
        : cleaned.replace(separator, ".");
    }
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMoneyAr(value: string | number | null | undefined): string {
  const parsed = parseMoney(value);
  if (parsed === null) return value ? String(value) : "";
  return parsed.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
