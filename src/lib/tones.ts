// Los únicos colores fijos del CRM: tonos traslúcidos para estados y avisos,
// legibles en modo claro y oscuro. El resto usa los tokens del tema.
export const tones = {
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  warning: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
} as const;

export type Tone = keyof typeof tones;

// Borde a juego para avisos en bloque (alertas, banners).
export const toneBorders: Record<Tone, string> = {
  neutral: "border-border",
  positive: "border-emerald-500/30",
  info: "border-sky-500/30",
  warning: "border-amber-500/30",
  danger: "border-destructive/30",
};
