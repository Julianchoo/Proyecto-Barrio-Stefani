import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  accent?: "green" | "amber" | "blue" | "red";
}

const accents = {
  green: {
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    bar: "bg-emerald-500",
    value: "text-emerald-900",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-100",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    bar: "bg-amber-500",
    value: "text-amber-900",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
    bar: "bg-blue-500",
    value: "text-blue-900",
  },
  red: {
    bg: "bg-rose-50",
    border: "border-rose-100",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
    bar: "bg-rose-500",
    value: "text-rose-900",
  },
};

export function StatsCard({ title, value, description, icon: Icon, accent = "green" }: StatsCardProps) {
  const a = accents[accent];
  return (
    <div className={`relative rounded-xl border ${a.border} ${a.bg} p-5 overflow-hidden`}>
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${a.bar}`} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 font-body leading-tight">{title}</span>
        {Icon && (
          <span className={`flex-shrink-0 p-1.5 rounded-lg ${a.iconBg}`}>
            <Icon className={`h-4 w-4 ${a.iconColor}`} />
          </span>
        )}
      </div>
      <div className={`text-3xl font-display font-light ${a.value} leading-none mb-1`}>{value}</div>
      {description && (
        <p className="text-xs text-gray-400 font-body mt-1.5">{description}</p>
      )}
    </div>
  );
}
