"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";

interface MacroRingCardProps {
  label: string;
  consumed: number;
  target: number;
  color: string;
  unit?: string;
}

export default function MacroRingCard({
  label,
  consumed,
  target,
  color,
  unit = "kcal",
}: MacroRingCardProps) {
  const pct = Math.min((consumed / target) * 100, 100);
  const remaining = Math.max(target - consumed, 0);
  const ringData = [{ value: pct, fill: color }];

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={ringData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar dataKey="value" background={{ fill: "#f3f4f6" }} cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-gray-900">{consumed}</span>
          <span className="text-xs text-gray-400">{unit}</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="text-xs text-gray-400">
        {remaining} {unit} left
      </p>
    </div>
  );
}
