"use client";

interface MacroRingCardProps {
  label: string;
  consumed: number;
  target: number;
  color: string;
  unit?: string;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function MacroRingCard({
  label,
  consumed,
  target,
  color,
  unit = "kcal",
}: MacroRingCardProps) {
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const remaining = Math.max(target - consumed, 0);
  const offset = CIRCUMFERENCE * (1 - pct);

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 100 100"
        >
          {/* Background track */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth="10"
          />
          {/* Progress arc */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-gray-900">
            {consumed % 1 === 0 ? consumed : consumed.toFixed(1)}
          </span>
          <span className="text-xs text-gray-400">{unit}</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="text-xs text-gray-400">
        {remaining % 1 === 0 ? remaining : remaining.toFixed(1)} {unit} left
      </p>
    </div>
  );
}
