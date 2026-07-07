interface CategorySectionProps {
  icon: React.ReactNode | string;
  label: string;
  badge?: React.ReactNode;
  headerColorClass?: string;
  children: React.ReactNode;
  className?: string;
}

export default function CategorySection({
  icon,
  label,
  badge,
  headerColorClass = "bg-white border-gray-100",
  children,
  className = "",
}: CategorySectionProps) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      <div className={`px-5 py-3.5 border-b ${headerColorClass} flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{icon}</span>
          <span className="font-semibold text-gray-800">{label}</span>
        </div>
        {badge && <div>{badge}</div>}
      </div>
      {children}
    </div>
  );
}
