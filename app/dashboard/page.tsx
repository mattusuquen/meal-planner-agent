"use client";

import { useState, useEffect, useCallback } from "react";
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
import Skeleton from "@/components/ui/Skeleton";
import FadeIn from "@/components/ui/FadeIn";
import type { DailyTotals, LoggedMeal, WeightEntry } from "@/lib/types";

type Tab = "daily" | "weekly" | "monthly" | "progress";

const slotColors: Record<string, string> = {
  Breakfast: "bg-amber-100 text-amber-700",
  Lunch: "bg-blue-100 text-blue-700",
  Snacks: "bg-purple-100 text-purple-700",
  Dinner: "bg-green-100 text-green-700",
};

const today = new Date().toISOString().split("T")[0];
const todayLabel = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

function getMealName(meal: LoggedMeal): string {
  if (meal.recipe_id && meal.recipe) return meal.recipe.name;
  return meal.custom_entry?.name ?? "Unknown";
}

function getMealMacros(meal: LoggedMeal) {
  const s = meal.servings ?? 1;
  if (meal.recipe_id && meal.recipe) {
    return {
      calories: Math.round(meal.recipe.calories * s),
      protein: Math.round(meal.recipe.protein_g * s),
      carbs: Math.round(meal.recipe.carbs_g * s),
      fat: Math.round(meal.recipe.fat_g * s),
    };
  }
  const e = meal.custom_entry;
  return {
    calories: Math.round((e?.calories ?? 0) * s),
    protein: Math.round((e?.protein_g ?? 0) * s),
    carbs: Math.round((e?.carbs_g ?? 0) * s),
    fat: Math.round((e?.fat_g ?? 0) * s),
  };
}

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("daily");

  // Daily state
  const [targets, setTargets] = useState({ calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 65 });
  const [totals, setTotals] = useState<DailyTotals | null>(null);
  const [meals, setMeals] = useState<LoggedMeal[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);

  // Trends state
  const [trendsData, setTrendsData] = useState<{ date: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[]>([]);
  const [trendsSummary, setTrendsSummary] = useState<{ avg_calories: number; avg_protein: number; adherence_days: number; total_days: number; calorie_target: number } | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // Progress state
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);

  const fetchDaily = useCallback(async () => {
    setDailyLoading(true);
    const res = await fetch(`/api/dashboard/daily?date=${today}`);
    if (res.ok) {
      const data = await res.json();
      setTargets(data.targets);
      setTotals(data.totals);
      setMeals(data.meals ?? []);
    }
    setDailyLoading(false);
  }, []);

  const fetchTrends = useCallback(async (period: "weekly" | "monthly") => {
    setTrendsLoading(true);
    const res = await fetch(`/api/dashboard/trends?period=${period}`);
    if (res.ok) {
      const data = await res.json();
      setTrendsData(data.data ?? []);
      setTrendsSummary(data.summary);
    }
    setTrendsLoading(false);
  }, []);

  const fetchProgress = useCallback(async () => {
    setProgressLoading(true);
    const [weightsRes, trendsRes] = await Promise.all([
      fetch("/api/weight?limit=90"),
      fetch("/api/dashboard/trends?period=monthly"),
    ]);
    if (weightsRes.ok) {
      const { entries } = await weightsRes.json();
      setWeightEntries(entries ?? []);
    }
    if (trendsRes.ok) {
      const data = await trendsRes.json();
      setTrendsData(data.data ?? []);
      setTrendsSummary(data.summary);
    }
    setProgressLoading(false);
  }, []);

  useEffect(() => { fetchDaily(); }, [fetchDaily]);

  useEffect(() => {
    if (tab === "weekly") fetchTrends("weekly");
    if (tab === "monthly") fetchTrends("monthly");
    if (tab === "progress") fetchProgress();
  }, [tab, fetchTrends, fetchProgress]);

  const tabs: { value: Tab; label: string }[] = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "progress", label: "Progress" },
  ];

  const t = totals ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const calPct = Math.min((t.calories / targets.calories) * 100, 100);

  // Format weekly data for chart (add day labels)
  const weeklyChartData = trendsData.map((d) => ({
    day: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
    calories: d.calories,
    protein: d.protein_g,
    carbs: d.carbs_g,
    fat: d.fat_g,
  }));

  // Format monthly data
  const monthlyChartData = trendsData.map((d) => ({
    day: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    calories: d.calories,
    target: trendsSummary?.calorie_target ?? 2000,
  }));

  // Progress chart: combine weight + calories
  const weightMap = new Map(weightEntries.map((w) => [w.entry_date, w.weight_kg * 2.20462]));
  const calMap = new Map(trendsData.map((d) => [d.date, d.calories]));
  const allDates = [...new Set([...weightMap.keys(), ...calMap.keys()])].sort();
  const progressChartData = allDates.map((date) => ({
    date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    weight: weightMap.has(date) ? Math.round(weightMap.get(date)! * 10) / 10 : undefined,
    calories: calMap.get(date),
  }));

  // Weight stats
  const weightLbs = weightEntries.map((w) => w.weight_kg * 2.20462);
  const currentWeight = weightLbs.length ? weightLbs[weightLbs.length - 1] : null;
  const startWeight = weightLbs.length ? weightLbs[0] : null;
  const weightChange = currentWeight && startWeight ? currentWeight - startWeight : null;

  // Rolling rate (last 7 days vs 7 days before)
  const recent7 = weightEntries.slice(-7);
  const prev7 = weightEntries.slice(-14, -7);
  let weeklyRate: number | null = null;
  if (recent7.length >= 2 && prev7.length >= 1) {
    const recentAvg = recent7.reduce((s, w) => s + w.weight_kg, 0) / recent7.length;
    const prevAvg = prev7.reduce((s, w) => s + w.weight_kg, 0) / prev7.length;
    weeklyRate = Math.round((recentAvg - prevAvg) * 2.20462 * 10) / 10;
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <PageHeader title="Dashboard" subtitle={todayLabel} />
      <TabSwitcher tabs={tabs} value={tab} onChange={setTab} scrollable className="mb-6" />

      {/* Daily Tab */}
      {tab === "daily" && (
        <div className="space-y-6">
          {dailyLoading ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-3">
                    <Skeleton className="w-20 h-20 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
              <Card className="p-4">
                <div className="flex justify-between mb-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-3 w-20 mt-1.5" />
              </Card>
              <Card className="overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center gap-3 border-b border-gray-50">
                    <Skeleton className="h-4 w-40" />
                    <div className="ml-auto flex gap-3">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                ))}
              </Card>
            </>
          ) : (
            <>
              <FadeIn delay={0}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MacroRingCard label="Calories" consumed={t.calories} target={targets.calories} color="#22c55e" unit="kcal" />
                  <MacroRingCard label="Protein" consumed={t.protein_g} target={targets.protein_g} color="#3b82f6" unit="g" />
                  <MacroRingCard label="Carbs" consumed={t.carbs_g} target={targets.carbs_g} color="#f59e0b" unit="g" />
                  <MacroRingCard label="Fat" consumed={t.fat_g} target={targets.fat_g} color="#f43f5e" unit="g" />
                </div>
              </FadeIn>

              <FadeIn delay={80}>
                <Card className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Calorie Budget</span>
                    <span className="text-sm text-gray-500">
                      {t.calories} / {targets.calories} kcal
                    </span>
                  </div>
                  <ProgressBar value={calPct} height="md" />
                  <p className="text-xs text-gray-400 mt-1.5">
                    {Math.max(0, targets.calories - t.calories)} kcal remaining
                  </p>
                </Card>
              </FadeIn>

              <FadeIn delay={160}>
                <Card className="overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="font-semibold text-gray-900">Today&apos;s Log</h2>
                    <a href="/journal" className="text-sm text-brand-600 font-medium hover:text-brand-700">+ Add food</a>
                  </div>
                  {meals.length === 0 ? (
                    <div className="px-5 py-10 text-center text-gray-400 text-sm">
                      No meals logged today. <a href="/journal" className="text-brand-600 hover:underline">Add your first meal →</a>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {meals.map((meal) => {
                        const macros = getMealMacros(meal);
                        return (
                          <FoodEntryRow
                            key={meal.id}
                            name={getMealName(meal)}
                            calories={macros.calories}
                            protein={macros.protein}
                            carbs={macros.carbs}
                            fat={macros.fat}
                            slot={meal.meal_slot}
                            slotColors={slotColors}
                            time={new Date(meal.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          />
                        );
                      })}
                    </div>
                  )}
                </Card>
              </FadeIn>
            </>
          )}
        </div>
      )}

      {/* Weekly Tab */}
      {tab === "weekly" && (
        <div className="space-y-6">
          {trendsLoading ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-7 w-24 mb-1" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                ))}
              </div>
              <Card className="p-5">
                <Skeleton className="h-5 w-28 mb-4" />
                <Skeleton className="w-full h-[280px]" />
              </Card>
            </>
          ) : (
            <>
              <FadeIn delay={0}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatsCard label="Avg Calories" value={trendsSummary ? `${trendsSummary.avg_calories.toLocaleString()}` : "—"} subtitle={`vs ${targets.calories.toLocaleString()} target`} />
                  <StatsCard label="Adherence" value={trendsSummary ? `${trendsSummary.adherence_days}/${trendsSummary.total_days} days` : "—"} subtitle="within ±10%" />
                  <StatsCard label="Avg Protein" value={trendsSummary ? `${trendsSummary.avg_protein}g` : "—"} subtitle={`vs ${targets.protein_g}g target`} />
                </div>
              </FadeIn>
              <FadeIn delay={80}>
                {weeklyChartData.length > 0 ? (
                  <Card className="p-5">
                    <h2 className="font-semibold text-gray-900 mb-4">7-Day Trend</h2>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={weeklyChartData}>
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
                ) : (
                  <Card className="p-12 text-center text-gray-400 text-sm">No data yet. Start logging meals to see trends.</Card>
                )}
              </FadeIn>
            </>
          )}
        </div>
      )}

      {/* Monthly Tab */}
      {tab === "monthly" && (
        <div className="space-y-6">
          {trendsLoading ? (
            <Card className="p-5">
              <Skeleton className="h-5 w-44 mb-4" />
              <Skeleton className="w-full h-[280px]" />
            </Card>
          ) : monthlyChartData.length > 0 ? (
            <FadeIn delay={0}>
              <Card className="p-5">
                <h2 className="font-semibold text-gray-900 mb-4">30-Day Calorie Trend</h2>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyChartData}>
                  <defs>
                    <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="calories" stroke="#22c55e" fill="url(#calGrad)" strokeWidth={2} name="Calories" />
                  <Line type="monotone" dataKey="target" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Target" />
                </AreaChart>
              </ResponsiveContainer>
              </Card>
            </FadeIn>
          ) : (
            <FadeIn delay={0}>
              <Card className="p-12 text-center text-gray-400 text-sm">No data yet. Start logging meals to see trends.</Card>
            </FadeIn>
          )}
        </div>
      )}

      {/* Progress Tab */}
      {tab === "progress" && (
        <div className="space-y-6">
          {progressLoading ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-7 w-24 mb-1" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                ))}
              </div>
              <Card className="p-5">
                <Skeleton className="h-5 w-48 mb-4" />
                <Skeleton className="w-full h-[300px]" />
              </Card>
            </>
          ) : (
            <>
              <FadeIn delay={0}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatsCard
                    label="Current Weight"
                    value={currentWeight ? `${currentWeight.toFixed(1)} lbs` : "—"}
                    subtitle={weightChange !== null ? `${weightChange >= 0 ? "+" : ""}${weightChange.toFixed(1)} lbs total` : "No data"}
                    valueColor={weightChange !== null && weightChange < 0 ? "text-green-600" : undefined}
                    size="sm"
                  />
                  <StatsCard
                    label="Weekly Rate"
                    value={weeklyRate !== null ? `${weeklyRate >= 0 ? "+" : ""}${weeklyRate} lbs/wk` : "—"}
                    subtitle={weightEntries.length < 2 ? "Log more entries" : "7-day avg"}
                    valueColor={weeklyRate !== null && weeklyRate < 0 ? "text-green-600" : undefined}
                    size="sm"
                  />
                  <StatsCard label="Days Logged" value={String(weightEntries.length)} subtitle="weight entries" size="sm" />
                </div>
              </FadeIn>
              <FadeIn delay={80}>
                {progressChartData.length > 0 ? (
                  <Card className="p-5">
                    <h2 className="font-semibold text-gray-900 mb-4">Weight vs. Calorie Intake</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={progressChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={3} />
                        <YAxis yAxisId="weight" tick={{ fontSize: 12 }} label={{ value: "lbs", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 11 } }} />
                        <YAxis yAxisId="cal" orientation="right" tick={{ fontSize: 12 }} label={{ value: "kcal", angle: 90, position: "insideRight", offset: 10, style: { fontSize: 11 } }} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="cal" dataKey="calories" fill="#d1fae5" name="Daily Calories" />
                        <Line yAxisId="weight" type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2.5} dot={false} name="Weight (lbs)" connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Card>
                ) : (
                  <Card className="p-12 text-center text-gray-400 text-sm">
                    No data yet. Log your weight and meals to see progress.
                  </Card>
                )}
              </FadeIn>
            </>
          )}
        </div>
      )}
    </div>
  );
}
