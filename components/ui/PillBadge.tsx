interface PillBadgeProps {
  label: string;
  className: string;
  size?: "xs" | "sm";
}

export default function PillBadge({ label, className, size = "xs" }: PillBadgeProps) {
  const sizeClasses = size === "xs" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span className={`rounded-full font-medium flex-shrink-0 ${sizeClasses} ${className}`}>
      {label}
    </span>
  );
}
