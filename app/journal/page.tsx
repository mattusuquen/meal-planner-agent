"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/shared/PageHeader";
import FoodEntryRow from "@/components/shared/FoodEntryRow";
import StatsCard from "@/components/shared/StatsCard";
import AddMealModal, { LogEntry } from "@/components/journal/AddMealModal";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { LoggedMeal, DailyTotals } from "@/lib/types";

type EntryMethod = "plan" | "recipe" | "search" | "text" | "photo" | "quick";

const methodBadge: Record<EntryMethod, { label: string; className: string }> = {
  plan: { label: "Plan", className: "bg-blue-100 text-blue-700" },
  recipe: { label: "Recipe", className: "bg-purple-100 text-purple-700" },
  search: { label: "Search", className: "bg-gray-100 text-gray-600" },
  text: { label: "AI Parse", className: "bg-amber-100 text-amber-700" },
  photo: { label: "Photo", className: "bg-pink-100 text-pink-700" },
  quick: { label: "Quick", className: "bg-green-100 text-green-700" },
};

const slotBorderColor: Record<string, string> = {
  Breakfast: "border-l-amber-400",
  Lunch: "border-l-blue-400",
  Dinner: "border-l-green-500",
  Snacks: "border-l-purple-400",
};

const slotIcon: Record<string, string> = {
  Breakfast: "🌅",
  Lunch: "☀️",
  Dinner: "🌙",
  Snacks: "🍎",
};

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

function toISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getMealName(meal: LoggedMeal): string {
  if (meal.recipe_id && (meal as LoggedMeal & { recipe?: { name: string } }).recipe) {
    return (meal as LoggedMeal & { recipe?: { name: string } }).recipe!.name;
  }
  return meal.custom_entry?.name ?? "Unknown";
}

function getMealMacros(meal: LoggedMeal) {
  const s = meal.servings ?? 1;
  const rec = (meal as LoggedMeal & { recipe?: { calories: number; protein_g: number; carbs_g: number; fat_g: number } }).recipe;
  if (meal.recipe_id && rec) {
    return {
      calories: Math.round(rec.calories * s),
      protein: Math.round(rec.protein_g * s),
      carbs: Math.round(rec.carbs_g * s),
      fat: Math.round(rec.fat_g * s),
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

export default function JournalPage() {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [meals, setMeals] = useState<LoggedMeal[]>([]);
  const [totals, setTotals] = useState<DailyTotals | null>(null);
  const [targets, setTargets] = useState({ calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 65 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; slot: string }>({ open: false, slot: "Breakfast" });
  const nextId = useRef(1000);

  const dateStr = toISO(currentDate);

  const fetchData = useCallback(async (date: string) => {
    setLoading(true);
    const [logsRes, dailyRes] = await Promise.all([
      fetch(`/api/log?date=${date}`),
      fetch(`/api/dashboard/daily?date=${date}`),
    ]);

    if (logsRes.ok) {
      const { meals: data } = await logsRes.json();
      setMeals(data ?? []);
    }
    if (dailyRes.ok) {
      const data = await dailyRes.json();
      setTargets(data.targets);
      setTotals(data.totals);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(dateStr);
  }, [dateStr, fetchData]);

  const openModal = (slot: string) => setModal({ open: true, slot });
  const closeModal = () => setModal({ open: false, slot: modal.slot });

  const handleAdd = async (slot: string, entries: Omit<LogEntry, "id">[]) => {
    for (const entry of entries) {
      const body = {
        logged_date: dateStr,
        meal_slot: slot,
        entry_method: entry.method,
        servings: entry.servings ?? 1,
        recipe_id: entry.recipe_id ?? undefined,
        custom_entry: entry.recipe_id ? undefined : {
          name: entry.name,
          calories: entry.calories,
          protein_g: entry.protein,
          carbs_g: entry.carbs,
          fat_g: entry.fat,
        },
        photo_url: entry.photoUrl ?? undefined,
      };

      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const { meal, daily_totals } = await res.json();
        setMeals((prev) => [...prev, meal]);
        if (daily_totals) setTotals(daily_totals);
      }
    }
  };

  const handleDelete = async (mealId: string) => {
    const res = await fetch(`/api/log?id=${mealId}`, { method: "DELETE" });
    if (res.ok) {
      const { daily_totals } = await res.json();
      setMeals((prev) => prev.filter((m) => m.id !== mealId));
      if (daily_totals) setTotals(daily_totals);
    }
  };

  const mealsBySlot = SLOTS.reduce((acc, slot) => {
    acc[slot] = meals.filter((m) => m.meal_slot === slot);
    return acc;
  }, {} as Record<string, LoggedMeal[]>);

  const t = totals ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cur = new Date(currentDate);
  cur.setHours(0, 0, 0, 0);
  const isToday = cur.getTime() === today.getTime();

  const dateLabel = currentDate.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  return (
    <>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <PageHeader title="Food Journal">
          <Button onClick={() => openModal("Breakfast")} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }>
            Add Food
          </Button>
        </PageHeader>

        {/* Date navigator */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setCurrentDate((d) => addDays(d, -1))}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-base font-semibold text-gray-900 min-w-[180px] text-center">{dateLabel}</span>
          <button
            onClick={() => setCurrentDate((d) => addDays(d, 1))}
            disabled={isToday}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {!isToday && (
            <button onClick={() => setCurrentDate(new Date())} className="text-sm text-brand-600 font-medium hover:text-brand-700">
              Today
            </button>
          )}
        </div>

        {/* Daily summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatsCard label="Calories" value={String(t.calories)} subtitle={`/ ${targets.calories} kcal`} valueColor="text-green-600" size="sm" />
          <StatsCard label="Protein" value={`${t.protein_g}g`} subtitle={`/ ${targets.protein_g}g`} valueColor="text-blue-600" size="sm" />
          <StatsCard label="Carbs" value={`${t.carbs_g}g`} subtitle={`/ ${targets.carbs_g}g`} valueColor="text-amber-600" size="sm" />
          <StatsCard label="Fat" value={`${t.fat_g}g`} subtitle={`/ ${targets.fat_g}g`} valueColor="text-rose-600" size="sm" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
        ) : (
          <div className="space-y-4">
            {SLOTS.map((slot) => {
              const slotMeals = mealsBySlot[slot] ?? [];
              const slotCal = slotMeals.reduce((s, m) => s + getMealMacros(m).calories, 0);
              return (
                <div key={slot} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 ${slotBorderColor[slot]}`}>
                  <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{slotIcon[slot]}</span>
                      <span className="font-semibold text-gray-900">{slot}</span>
                    </div>
                    <span className="text-sm text-gray-500 font-medium">{slotCal} kcal</span>
                  </div>

                  {slotMeals.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-gray-400 italic">No entries yet</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {slotMeals.map((meal) => {
                        const macros = getMealMacros(meal);
                        return (
                          <FoodEntryRow
                            key={meal.id}
                            name={getMealName(meal)}
                            calories={macros.calories}
                            protein={macros.protein}
                            carbs={macros.carbs}
                            fat={macros.fat}
                            method={meal.entry_method as EntryMethod}
                            methodBadge={methodBadge}
                            servings={meal.servings}
                            photoUrl={meal.photo_url ?? undefined}
                            onDelete={() => handleDelete(meal.id)}
                          />
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => openModal(slot)}
                    className="w-full px-5 py-3 border-t border-dashed border-gray-200 text-sm text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add to {slot}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal.open && (
        <AddMealModal slot={modal.slot} onClose={closeModal} onAdd={handleAdd} currentDate={dateStr} />
      )}
    </>
  );
}
