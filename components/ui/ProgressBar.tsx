interface ProgressBarProps {
  value: number;
  colorClass?: string;
  height?: "xs" | "sm" | "md";
  className?: string;
}

const heightClasses = { xs: "h-1.5", sm: "h-2", md: "h-3" };

export default function ProgressBar({
  value,
  colorClass = "bg-brand-500",
  height = "sm",
  className = "",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={`bg-gray-100 rounded-full overflow-hidden ${heightClasses[height]} ${className}`}>
      <div
        className={`h-full ${colorClass} rounded-full transition-all`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
