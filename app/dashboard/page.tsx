"use client";

import { useState } from "react";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
} from "recharts";

type Tab = "daily" | "weekly" | "monthly" | "progress";

const targets = { calories: 2200, protein: 165, carbs: 220, fat: 73 };
const todayTotals = { calories: 1480, protein: 112, carbs: 148, fat: 51 };

const loggedMeals = [
  { id: 1, slot: "Breakfast", name: "Greek Yogurt Parfait", calories: 380, protein: 28, carbs: 42, fat: 12, time: "7:30 AM" },
  { id: 2, slot: "Lunch", name: "Grilled Chicken Bowl", calories: 620, protein: 52, carbs: 68, fat: 22, time: "12:15 PM" },
  { id: 3, slot: "Snack", name: "Apple + Almond Butter", calories: 220, protein: 6, carbs: 28, fat: 11, time: "3:00 PM" },
  { id: 4, slot: "Dinner", name: "Salmon & Roasted Veg", calories: 260, protein: 26, carbs: 10, fat: 6, time: "Planned" },
];

const weeklyData = [
  { day: "Mon", calories: 2180, protein: 162, carbs: 215, fat: 71 },
  { day: "Tue", calories: 1950, protein: 148, carbs: 195, fat: 65 },
  { day: "Wed", calories: 2240, protein: 170, carbs: 228, fat: 74 },
  { day: "Thu", calories: 2100, protein: 158, carbs: 210, fat: 70 },
  { day: "Fri", calories: 1880, protein: 142, carbs: 185, fat: 62 },
  { day: "Sat", calories: 2350, protein: 175, carbs: 240, fat: 78 },
  { day: "Sun", calories: 1480, protein: 112, carbs: 148, fat: 51 },
];

const monthlyData = Array.from({ length: 30 }, (_, i) => ({
  day: `Jun ${i + 1 <= 30 ? i + 1 : i - 29}`,
  calories: Math.round(2000 + Math.sin(i * 0.4) * 300 + Math.random() * 200),
  target: 2200,
}));

const weeklyAdherence = [
  { week: "Week 1", avg: 2050, target: 2200, days: 5 },
  { week: "Week 2", avg: 2180, target: 2200, days: 6 },
  { week: "Week 3", avg: 1920, target: 2200, days: 4 },
  { week: "Week 4", avg: 2210, target: 2200, days: 6 },
];

const progressData = Array.from({ length: 28 }, (_, i) => ({
  date: `Jun ${i + 1 <= 9 ? "0" : ""}${i + 1 > 30 ? i - 29 : i + 1}`,
  weight: parseFloat((185.2 - i * 0.12 + (Math.random() - 0.5) * 0.8).toFixed(1)),
  calories: Math.round(2200 - i * 5 + (Math.random() - 0.5) * 300),
}));

const slotColors: Record<string, string> = {
  Breakfast: "bg-amber-100 text-amber-700",
  Lunch: "bg-blue-100 text-blue-700",
  Snack: "bg-purple-100 text-purple-700",
  Dinner: "bg-green-100 text-green-700",
};

function MacroRingCard({
  label,
  consumed,
  target,
  color,
  unit = "kcal",
}: {
  label: string;
  consumed: number;
  target: number;
  color: string;
  unit?: string;
}) {
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

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("daily");

  const tabs: { value: Tab; label: string }[] = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "progress", label: "Progress" },
  ];

  const calPct = (todayTotals.calories / targets.calories) * 100;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-500">Sunday, July 6, 2026</p>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Daily Tab */}
      {tab === "daily" && (
        <div className="space-y-6">
          {/* Macro rings */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MacroRingCard label="Calories" consumed={todayTotals.calories} target={targets.calories} color="#22c55e" unit="kcal" />
            <MacroRingCard label="Protein" consumed={todayTotals.protein} target={targets.protein} color="#3b82f6" unit="g" />
            <MacroRingCard label="Carbs" consumed={todayTotals.carbs} target={targets.carbs} color="#f59e0b" unit="g" />
            <MacroRingCard label="Fat" consumed={todayTotals.fat} target={targets.fat} color="#f43f5e" unit="g" />
          </div>

          {/* Calorie budget bar */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Calorie Budget</span>
              <span className="text-sm text-gray-500">
                {todayTotals.calories} / {targets.calories} kcal
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${calPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{targets.calories - todayTotals.calories} kcal remaining</p>
          </div>

          {/* Today's Log */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Today&apos;s Log</h2>
              <button className="text-sm text-brand-600 font-medium hover:text-brand-700">+ Add food</button>
            </div>
            <div className="divide-y divide-gray-50">
              {loggedMeals.map((meal) => (
                <div key={meal.id} className="px-5 py-3.5 flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${slotColors[meal.slot] ?? "bg-gray-100 text-gray-600"}`}>
                    {meal.slot}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{meal.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{meal.calories} kcal</span>
                      <span className="text-xs text-blue-500">P {meal.protein}g</span>
                      <span className="text-xs text-amber-500">C {meal.carbs}g</span>
                      <span className="text-xs text-rose-500">F {meal.fat}g</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{meal.time}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Weekly Tab */}
      {tab === "weekly" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Avg Calories", value: "2,026", sub: "vs 2,200 target" },
              { label: "Adherence", value: "5/7 days", sub: "within ±10%" },
              { label: "Avg Protein", value: "152g", sub: "vs 165g target" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">7-Day Trend</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="calories" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name="Calories" />
                <Line type="monotone" dataKey="protein" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Protein (g)" />
                <Line type="monotone" dataKey="carbs" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="Carbs (g)" />
                <Line type="monotone" dataKey="fat" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4 }} name="Fat (g)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly Tab */}
      {tab === "monthly" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">30-Day Calorie Trend</h2>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 12 }} domain={[1200, 2800]} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="calories" stroke="#22c55e" fill="url(#calGrad)" strokeWidth={2} name="Calories" />
                <Line type="monotone" dataKey="target" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Target" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Weekly Adherence</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {weeklyAdherence.map((w) => (
                <div key={w.week} className="px-5 py-3.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{w.week}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{w.avg} avg kcal</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${w.days >= 5 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {w.days}/7 days on target
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Progress Tab */}
      {tab === "progress" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Current Weight", value: "183.1 lbs", change: "-2.1 lbs", positive: true },
              { label: "Weekly Rate", value: "-0.5 lbs/wk", change: "on track", positive: true },
              { label: "Goal", value: "175 lbs", change: "8.1 lbs to go", positive: false },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
                <p className={`text-xs mt-0.5 font-medium ${s.positive ? "text-green-600" : "text-gray-400"}`}>{s.change}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Weight vs. Calorie Intake</h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={3} />
                <YAxis yAxisId="weight" domain={[179, 187]} tick={{ fontSize: 12 }} label={{ value: "lbs", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11 } }} />
                <YAxis yAxisId="cal" orientation="right" domain={[1500, 2800]} tick={{ fontSize: 12 }} label={{ value: "kcal", angle: 90, position: "insideRight", offset: 10, style: { fontSize: 11 } }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="cal" dataKey="calories" fill="#d1fae5" name="Daily Calories" />
                <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2.5} dot={false} name="Weight (lbs)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
