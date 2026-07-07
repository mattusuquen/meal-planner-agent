"use client";

import { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import Button from "@/components/ui/Button";

interface MealCell {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

type Plan = Record<string, Record<string, MealCell | null>>;

const weeks: { label: string; plan: Plan }[] = [
  {
    label: "Jun 30 – Jul 6",
    plan: {
      "Mon Jun 30": {
        Breakfast: { name: "Avocado Toast & Eggs", calories: 450, protein: 22, carbs: 38, fat: 24 },
        Lunch: { name: "Chicken Caesar Salad", calories: 580, protein: 48, carbs: 22, fat: 31 },
        Dinner: { name: "Beef Stir Fry & Rice", calories: 620, protein: 46, carbs: 58, fat: 18 },
        Snacks: { name: "Greek Yogurt", calories: 150, protein: 17, carbs: 12, fat: 3 },
      },
      "Tue Jul 1": {
        Breakfast: { name: "Protein Smoothie Bowl", calories: 420, protein: 32, carbs: 48, fat: 10 },
        Lunch: { name: "Turkey Wrap + Side", calories: 540, protein: 42, carbs: 52, fat: 16 },
        Dinner: { name: "Salmon & Roasted Veg", calories: 560, protein: 44, carbs: 28, fat: 26 },
        Snacks: null,
      },
      "Wed Jul 2": {
        Breakfast: { name: "Overnight Oats", calories: 410, protein: 14, carbs: 68, fat: 9 },
        Lunch: { name: "Grilled Chicken Bowl", calories: 620, protein: 52, carbs: 68, fat: 22 },
        Dinner: { name: "Shrimp Tacos (3)", calories: 580, protein: 38, carbs: 62, fat: 19 },
        Snacks: { name: "Apple + Almond Butter", calories: 220, protein: 6, carbs: 28, fat: 11 },
      },
      "Thu Jul 3": {
        Breakfast: { name: "Veggie Omelette", calories: 380, protein: 28, carbs: 12, fat: 24 },
        Lunch: null,
        Dinner: { name: "Pasta Primavera", calories: 640, protein: 28, carbs: 88, fat: 18 },
        Snacks: { name: "Protein Bar", calories: 200, protein: 20, carbs: 22, fat: 7 },
      },
      "Fri Jul 4": {
        Breakfast: { name: "Acai Bowl", calories: 460, protein: 12, carbs: 72, fat: 14 },
        Lunch: { name: "BLT Sandwich", calories: 510, protein: 26, carbs: 48, fat: 24 },
        Dinner: { name: "BBQ Chicken & Corn", calories: 680, protein: 52, carbs: 44, fat: 28 },
        Snacks: null,
      },
      "Sat Jul 5": {
        Breakfast: { name: "Pancakes & Berries", calories: 520, protein: 18, carbs: 82, fat: 14 },
        Lunch: { name: "Greek Salad + Pita", calories: 440, protein: 16, carbs: 52, fat: 18 },
        Dinner: { name: "Pork Tenderloin", calories: 590, protein: 54, carbs: 32, fat: 24 },
        Snacks: { name: "Hummus & Veggies", calories: 180, protein: 8, carbs: 22, fat: 7 },
      },
      "Sun Jul 6": {
        Breakfast: { name: "Greek Yogurt Parfait", calories: 380, protein: 28, carbs: 42, fat: 12 },
        Lunch: { name: "Grilled Chicken Bowl", calories: 620, protein: 52, carbs: 68, fat: 22 },
        Dinner: null,
        Snacks: { name: "Apple + Almond Butter", calories: 220, protein: 6, carbs: 28, fat: 11 },
      },
    },
  },
  {
    label: "Jul 7 – Jul 13",
    plan: {
      "Mon Jul 7": {
        Breakfast: { name: "Chia Pudding", calories: 360, protein: 12, carbs: 44, fat: 16 },
        Lunch: { name: "Tuna Poke Bowl", calories: 580, protein: 46, carbs: 62, fat: 16 },
        Dinner: { name: "Lemon Herb Chicken", calories: 560, protein: 50, carbs: 28, fat: 22 },
        Snacks: { name: "Mixed Nuts", calories: 170, protein: 5, carbs: 7, fat: 15 },
      },
      "Tue Jul 8": {
        Breakfast: null,
        Lunch: { name: "Chicken Quesadilla", calories: 620, protein: 44, carbs: 58, fat: 22 },
        Dinner: { name: "Veggie Curry & Rice", calories: 540, protein: 18, carbs: 82, fat: 16 },
        Snacks: null,
      },
      "Wed Jul 9": {
        Breakfast: { name: "Egg White Scramble", calories: 300, protein: 32, carbs: 14, fat: 10 },
        Lunch: { name: "Caprese Sandwich", calories: 490, protein: 22, carbs: 52, fat: 20 },
        Dinner: { name: "Steak & Sweet Potato", calories: 680, protein: 56, carbs: 48, fat: 26 },
        Snacks: { name: "Cottage Cheese", calories: 140, protein: 24, carbs: 6, fat: 2 },
      },
      "Thu Jul 10": {
        Breakfast: { name: "Banana Oat Pancakes", calories: 440, protein: 16, carbs: 72, fat: 10 },
        Lunch: { name: "Cobb Salad", calories: 560, protein: 44, carbs: 14, fat: 36 },
        Dinner: { name: "Teriyaki Salmon", calories: 580, protein: 48, carbs: 38, fat: 24 },
        Snacks: null,
      },
      "Fri Jul 11": {
        Breakfast: { name: "Avocado Toast & Eggs", calories: 450, protein: 22, carbs: 38, fat: 24 },
        Lunch: null,
        Dinner: { name: "Pizza Margherita (2 sl)", calories: 580, protein: 24, carbs: 72, fat: 22 },
        Snacks: { name: "Protein Shake", calories: 160, protein: 28, carbs: 8, fat: 2 },
      },
      "Sat Jul 12": {
        Breakfast: { name: "French Toast", calories: 480, protein: 16, carbs: 68, fat: 16 },
        Lunch: { name: "Fish Tacos (3)", calories: 560, protein: 36, carbs: 58, fat: 20 },
        Dinner: { name: "Lamb Chops & Salad", calories: 640, protein: 52, carbs: 18, fat: 38 },
        Snacks: { name: "Dark Chocolate", calories: 150, protein: 2, carbs: 18, fat: 8 },
      },
      "Sun Jul 13": {
        Breakfast: { name: "Smoked Salmon Bagel", calories: 490, protein: 28, carbs: 52, fat: 18 },
        Lunch: { name: "Minestrone Soup", calories: 380, protein: 16, carbs: 58, fat: 8 },
        Dinner: { name: "Roast Chicken & Veg", calories: 620, protein: 54, carbs: 32, fat: 24 },
        Snacks: null,
      },
    },
  },
];

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

const slotColor: Record<string, string> = {
  Breakfast: "text-amber-600",
  Lunch: "text-blue-600",
  Dinner: "text-green-600",
  Snacks: "text-purple-600",
};

export default function MealPlanPage() {
  const [weekIdx, setWeekIdx] = useState(0);
  const [mobileDayIdx, setMobileDayIdx] = useState(6); // default to last day (today)
  const week = weeks[weekIdx];
  const days = Object.keys(week.plan);

  const dayTotals = days.map((day) => {
    const meals = week.plan[day];
    return SLOTS.reduce((sum, slot) => sum + (meals[slot]?.calories ?? 0), 0);
  });

  const weekNav = (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
        disabled={weekIdx === 0}
        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))}
        disabled={weekIdx === weeks.length - 1}
        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Meal Plan" subtitle={`Week of ${week.label}`}>
        {weekNav}
        <Button
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        >
          Generate Grocery List
        </Button>
      </PageHeader>

      {/* ── MOBILE: Day-by-day view ── */}
      <div className="block md:hidden">
        {/* Day selector strip */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
          {days.map((day, i) => {
            const total = dayTotals[i];
            const isActive = mobileDayIdx === i;
            return (
              <button
                key={day}
                onClick={() => setMobileDayIdx(i)}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border-2 transition-all ${
                  isActive ? "border-brand-600 bg-brand-50" : "border-gray-100 bg-white hover:border-gray-200"
                }`}
              >
                <span className={`text-xs font-semibold uppercase tracking-wide ${isActive ? "text-brand-600" : "text-gray-500"}`}>
                  {day.split(" ")[0]}
                </span>
                <span className={`text-sm font-bold ${isActive ? "text-brand-700" : "text-gray-900"}`}>
                  {day.split(" ").slice(1).join(" ")}
                </span>
                {total > 0 && (
                  <span className={`text-xs mt-0.5 ${isActive ? "text-brand-600" : "text-gray-400"}`}>{total}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day meals */}
        <div className="space-y-3">
          {SLOTS.map((slot) => {
            const selectedDay = days[mobileDayIdx];
            const meal = week.plan[selectedDay]?.[slot];
            if (!meal) {
              return (
                <div
                  key={slot}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-brand-400 hover:bg-brand-50 cursor-pointer transition-colors group"
                >
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className={`text-sm font-semibold ${slotColor[slot]}`}>{slot}</span>
                  <span className="text-xs text-gray-300 group-hover:text-brand-500">Empty — tap to add</span>
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
                  <button className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Day total */}
          <div className="text-center py-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">Daily total: </span>
            <span className={`text-sm font-bold ${dayTotals[mobileDayIdx] > 0 ? (Math.abs(dayTotals[mobileDayIdx] - 2200) < 200 ? "text-green-600" : "text-gray-700") : "text-gray-300"}`}>
              {dayTotals[mobileDayIdx] > 0 ? `${dayTotals[mobileDayIdx]} kcal` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* ── DESKTOP: 7-column grid ── */}
      <div className="hidden md:block overflow-x-auto">
        <div className="min-w-[960px]">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {days.map((day) => (
              <div key={day} className="text-center">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {day.split(" ")[0]}
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {day.split(" ").slice(1).join(" ")}
                </p>
              </div>
            ))}
          </div>

          {/* Meal rows */}
          {SLOTS.map((slot) => (
            <div key={slot} className="grid grid-cols-7 gap-2 mb-2">
              {days.map((day) => {
                const meal = week.plan[day][slot];
                if (!meal) {
                  return (
                    <div
                      key={day}
                      className="border-2 border-dashed border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center min-h-[100px] hover:border-brand-400 hover:bg-brand-50 cursor-pointer transition-colors group"
                    >
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-xs text-gray-300 group-hover:text-brand-500 mt-1">{slot}</span>
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
                    <button className="mt-2 self-end p-1 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Daily totals footer */}
          <div className="grid grid-cols-7 gap-2 mt-2 border-t border-gray-200 pt-3">
            {dayTotals.map((total, i) => (
              <div key={i} className="text-center">
                <p className="text-xs text-gray-500">Total</p>
                <p className={`text-sm font-bold ${total > 0 ? (Math.abs(total - 2200) < 200 ? "text-green-600" : "text-gray-700") : "text-gray-300"}`}>
                  {total > 0 ? `${total} kcal` : "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
