"use client";

import { useState } from "react";
import {
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
  ResponsiveContainer,
} from "recharts";
import MacroRingCard from "@/components/shared/MacroRingCard";
import StatsCard from "@/components/shared/StatsCard";
import TabSwitcher from "@/components/shared/TabSwitcher";
import FoodEntryRow from "@/components/shared/FoodEntryRow";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import PillBadge from "@/components/ui/PillBadge";

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
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <PageHeader title="Dashboard" subtitle="Sunday, July 6, 2026" />

      <TabSwitcher tabs={tabs} value={tab} onChange={setTab} scrollable className="mb-6" />

      {/* Daily Tab */}
      {tab === "daily" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MacroRingCard label="Calories" consumed={todayTotals.calories} target={targets.calories} color="#22c55e" unit="kcal" />
            <MacroRingCard label="Protein" consumed={todayTotals.protein} target={targets.protein} color="#3b82f6" unit="g" />
            <MacroRingCard label="Carbs" consumed={todayTotals.carbs} target={targets.carbs} color="#f59e0b" unit="g" />
            <MacroRingCard label="Fat" consumed={todayTotals.fat} target={targets.fat} color="#f43f5e" unit="g" />
          </div>

          <Card className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Calorie Budget</span>
              <span className="text-sm text-gray-500">
                {todayTotals.calories} / {targets.calories} kcal
              </span>
            </div>
            <ProgressBar value={calPct} height="md" />
            <p className="text-xs text-gray-400 mt-1.5">{targets.calories - todayTotals.calories} kcal remaining</p>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">Today&apos;s Log</h2>
              <button className="text-sm text-brand-600 font-medium hover:text-brand-700">+ Add food</button>
            </div>
            <div className="divide-y divide-gray-50">
              {loggedMeals.map((meal) => (
                <FoodEntryRow
                  key={meal.id}
                  name={meal.name}
                  calories={meal.calories}
                  protein={meal.protein}
                  carbs={meal.carbs}
                  fat={meal.fat}
                  slot={meal.slot}
                  slotColors={slotColors}
                  time={meal.time}
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Weekly Tab */}
      {tab === "weekly" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard label="Avg Calories" value="2,026" subtitle="vs 2,200 target" />
            <StatsCard label="Adherence" value="5/7 days" subtitle="within ±10%" />
            <StatsCard label="Avg Protein" value="152g" subtitle="vs 165g target" />
          </div>
          <Card className="p-5">
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
          </Card>
        </div>
      )}

      {/* Monthly Tab */}
      {tab === "monthly" && (
        <div className="space-y-6">
          <Card className="p-5">
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
          </Card>
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Weekly Adherence</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {weeklyAdherence.map((w) => (
                <div key={w.week} className="px-5 py-3.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{w.week}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{w.avg} avg kcal</span>
                    <PillBadge
                      label={`${w.days}/7 days on target`}
                      className={w.days >= 5 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Progress Tab */}
      {tab === "progress" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard label="Current Weight" value="183.1 lbs" subtitle="-2.1 lbs" valueColor="text-green-600" size="sm" />
            <StatsCard label="Weekly Rate" value="-0.5 lbs/wk" subtitle="on track" valueColor="text-green-600" size="sm" />
            <StatsCard label="Goal" value="175 lbs" subtitle="8.1 lbs to go" size="sm" />
          </div>
          <Card className="p-5">
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
          </Card>
        </div>
      )}
    </div>
  );
}
