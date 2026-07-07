interface StatsCardProps {
  label: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
  size?: "sm" | "md";
  className?: string;
}

export default function StatsCard({
  label,
  value,
  subtitle,
  valueColor = "text-gray-900",
  size = "md",
  className = "",
}: StatsCardProps) {
  const roundedClass = size === "sm" ? "rounded-xl" : "rounded-2xl";
  const valueClass = size === "sm" ? "text-xl" : "text-2xl";

  return (
    <div className={`bg-white ${roundedClass} p-4 border border-gray-100 shadow-sm ${className}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`${valueClass} font-bold mt-1 ${valueColor}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
