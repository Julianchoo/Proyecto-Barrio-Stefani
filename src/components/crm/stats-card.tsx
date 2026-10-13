import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  tone?: "danger" | undefined;
}

export function StatsCard({ title, value, description, tone }: StatsCardProps) {
  return (
    <div className="h-full rounded-xl border bg-card p-5">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p
        className={cn(
          "mt-2 font-serif text-3xl font-normal leading-none tabular-nums text-foreground",
          tone === "danger" && "text-destructive"
        )}
      >
        {value}
      </p>
      {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
