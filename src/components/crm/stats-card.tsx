import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  note?: string | undefined;
  tone?: "danger" | undefined;
  href?: string | undefined;
}

export function StatsCard({ title, value, description, note, tone, href }: StatsCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{title}</p>
        {href && (
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
        )}
      </div>
      <p
        className={cn(
          "mt-2 font-serif text-3xl font-normal leading-none lining-nums tabular-nums text-foreground",
          tone === "danger" && "text-destructive"
        )}
      >
        {value}
      </p>
      {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
      {note && <p className="mt-1 text-[11px] text-muted-foreground/70">{note}</p>}
    </>
  );

  const card = "h-full rounded-xl border bg-card p-5";
  return href ? (
    <Link href={href} className={cn(card, "group block transition-colors hover:bg-muted/50")}>
      {body}
    </Link>
  ) : (
    <div className={card}>{body}</div>
  );
}
