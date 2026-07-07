"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import Button from "@/components/ui/Button";
import type { MealPlan, MealCell } from "@/lib/types";

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

const slotColor: Record<string, string> = {
  Breakfast: "text-amber-600",
  Lunch: "text-blue-600",
  Dinner: "text-green-600",
  Snacks: "text-purple-600",
};

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getWeekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toISO(addDays(monday, i)));
}

function formatDay(isoDate: string): { short: string; rest: string } {
  const d = new Date(isoDate + "T12:00:00");
  const short = d.toLocaleDateString("en-US", { weekday: "short" });
  const rest = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { short, rest };
}

function formatWeekLabel(monday: Date): string {
  const end = addDays(monday, 6);
  return `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export default function MealPlanPage() {
  const router = useRouter();
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [swappingKey, setSwappingKey] = useState<string | null>(null);
  const [mobileDayIdx, setMobileDayIdx] = useState(() => {
    const today = new Date();
    const todayMonday = getMonday(today);
    const diff = Math.floor((today.getTime() - todayMonday.getTime()) / 86400000);
    return Math.max(0, Math.min(6, diff));
  });

  const weekStart = toISO(monday);
  const days = getWeekDays(monday);

  const fetchPlan = useCallback(async (ws: string) => {
    setLoading(true);
    const res = await fetch(`/api/plan?week_start=${ws}`);
    if (res.ok) {
      const { plan: data } = await res.json();
      setPlan(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlan(weekStart);
  }, [weekStart, fetchPlan]);

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await fetch("/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: weekStart }),
    });
    if (res.ok) {
      const { plan: data } = await res.json();
      setPlan(data);
    }
    setGenerating(false);
  };

  const handleSwap = async (day: string, slot: string) => {
    if (!plan) return;
    const key = `${day}-${slot}`;
    setSwappingKey(key);
    const res = await fetch("/api/plan/swap-meal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: plan.id, day, slot }),
    });
    if (res.ok) {
      const { meal } = await res.json();
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          plan: {
            ...prev.plan,
            [day]: { ...(prev.plan[day] ?? {}), [slot]: meal },
          },
        };
      });
    }
    setSwappingKey(null);
  };

  const handleGroceryList = async () => {
    await fetch("/api/grocery/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: weekStart }),
    });
    router.push("/grocery-list");
  };

  const dayTotals = days.map((day) => {
    if (!plan?.plan[day]) return 0;
    return SLOTS.reduce((sum, slot) => {
      const meal = plan.plan[day][slot] as MealCell | null;
      return sum + (meal?.calories ?? 0);
    }, 0);
  });

  const weekNav = (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setMonday((m) => addDays(m, -7))}
        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => setMonday((m) => addDays(m, 7))}
        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Meal Plan" subtitle={`Week of ${formatWeekLabel(monday)}`}>
        {weekNav}
        {plan && (
          <Button
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            onClick={handleGroceryList}
          >
            Grocery List
          </Button>
        )}
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading plan...</div>
      ) : !plan ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-5xl">📅</div>
          <h3 className="text-lg font-semibold text-gray-800">No plan for this week</h3>
          <p className="text-gray-500 text-sm">Let AI generate a personalized meal plan based on your goals.</p>
          <Button onClick={handleGenerate} disabled={generating} size="lg">
            {generating ? "Generating plan..." : "Generate Weekly Plan"}
          </Button>
        </div>
      ) : (
        <>
          {/* ── MOBILE: Day-by-day view ── */}
          <div className="block md:hidden">
            <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
              {days.map((day, i) => {
                const total = dayTotals[i];
                const isActive = mobileDayIdx === i;
                const { short, rest } = formatDay(day);
                return (
                  <button
                    key={day}
                    onClick={() => setMobileDayIdx(i)}
                    className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border-2 transition-all ${
                      isActive ? "border-brand-600 bg-brand-50" : "border-gray-100 bg-white hover:border-gray-200"
                    }`}
                  >
                    <span className={`text-xs font-semibold uppercase tracking-wide ${isActive ? "text-brand-600" : "text-gray-500"}`}>
                      {short}
                    </span>
                    <span className={`text-sm font-bold ${isActive ? "text-brand-700" : "text-gray-900"}`}>
                      {rest.split(" ")[1]}
                    </span>
                    {total > 0 && (
                      <span className={`text-xs mt-0.5 ${isActive ? "text-brand-600" : "text-gray-400"}`}>{total}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              {SLOTS.map((slot) => {
                const selectedDay = days[mobileDayIdx];
                const meal = plan.plan[selectedDay]?.[slot] as MealCell | null;
                const key = `${selectedDay}-${slot}`;
                const isSwapping = swappingKey === key;

                if (!meal) {
                  return (
                    <div key={slot} className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center gap-3">
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className={`text-sm font-semibold ${slotColor[slot]}`}>{slot}</span>
                      <span className="text-xs text-gray-300">Empty</span>
                    </div>
                  );
                }
                return (
                  <div key={slot} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${slotColor[slot]}`}>{slot}</span>
                    <p className="text-sm font-medium text-gray-900 mt-1">{meal.name}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm font-semibold text-gray-700">{meal.calories} kcal</span>
                      <span className="text-xs text-blue-500">P{meal.protein}</span>
                      <span className="text-xs text-amber-500">C{meal.carbs}</span>
                      <span className="text-xs text-rose-500">F{meal.fat}</span>
                      <button
                        onClick={() => handleSwap(selectedDay, slot)}
                        disabled={isSwapping}
                        className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors disabled:opacity-40"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="text-center py-2 border-t border-gray-100">
                <span className="text-xs text-gray-500">Daily total: </span>
                <span className={`text-sm font-bold ${dayTotals[mobileDayIdx] > 0 ? "text-green-600" : "text-gray-300"}`}>
                  {dayTotals[mobileDayIdx] > 0 ? `${dayTotals[mobileDayIdx]} kcal` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* ── DESKTOP: 7-column grid ── */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[960px]">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {days.map((day) => {
                  const { short, rest } = formatDay(day);
                  return (
                    <div key={day} className="text-center">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{short}</p>
                      <p className="text-sm font-bold text-gray-900">{rest}</p>
                    </div>
                  );
                })}
              </div>

              {SLOTS.map((slot) => (
                <div key={slot} className="grid grid-cols-7 gap-2 mb-2">
                  {days.map((day) => {
                    const meal = plan.plan[day]?.[slot] as MealCell | null;
                    const key = `${day}-${slot}`;
                    const isSwapping = swappingKey === key;

                    if (!meal) {
                      return (
                        <div key={day} className="border-2 border-dashed border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center min-h-[100px]">
                          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="text-xs text-gray-300 mt-1">{slot}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={day} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm min-h-[100px] flex flex-col justify-between group hover:border-brand-300 transition-colors">
                        <div>
                          <span className={`text-xs font-semibold uppercase tracking-wide ${slotColor[slot]}`}>{slot}</span>
                          <p className="text-sm font-medium text-gray-900 mt-1 leading-tight line-clamp-2">{meal.name}</p>
                        </div>
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-gray-700">{meal.calories} kcal</p>
                          <div className="flex gap-1.5 mt-0.5">
                            <span className="text-xs text-blue-500">P{meal.protein}</span>
                            <span className="text-xs text-amber-500">C{meal.carbs}</span>
                            <span className="text-xs text-rose-500">F{meal.fat}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSwap(day, slot)}
                          disabled={isSwapping}
                          className="mt-2 self-end p-1 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="grid grid-cols-7 gap-2 mt-2 border-t border-gray-200 pt-3">
                {dayTotals.map((total, i) => (
                  <div key={i} className="text-center">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className={`text-sm font-bold ${total > 0 ? "text-green-600" : "text-gray-300"}`}>
                      {total > 0 ? `${total} kcal` : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
