interface MacroDisplayProps {
  protein: number;
  carbs: number;
  fat: number;
  size?: "xs" | "sm";
  className?: string;
}

export default function MacroDisplay({ protein, carbs, fat, size = "xs", className = "" }: MacroDisplayProps) {
  const textClass = size === "xs" ? "text-xs" : "text-sm";
  return (
    <div className={`flex gap-2 ${className}`}>
      <span className={`${textClass} text-blue-500`}>P {protein}g</span>
      <span className={`${textClass} text-amber-500`}>C {carbs}g</span>
      <span className={`${textClass} text-rose-500`}>F {fat}g</span>
    </div>
  );
}
