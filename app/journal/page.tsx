"use client";

import { useState } from "react";

type EntryMethod = "plan" | "recipe" | "search" | "text" | "photo" | "quick";

interface LogEntry {
  id: number;
  name: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  method: EntryMethod;
}

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

const journalData: Record<string, LogEntry[]> = {
  Breakfast: [
    { id: 1, name: "Overnight Oats with Berries", servings: 1, calories: 410, protein: 14, carbs: 68, fat: 9, method: "recipe" },
    { id: 2, name: "Cold Brew Coffee", servings: 1, calories: 15, protein: 0, carbs: 3, fat: 0, method: "quick" },
  ],
  Lunch: [
    { id: 3, name: "Turkey & Avocado Wrap", servings: 1.5, calories: 540, protein: 42, carbs: 52, fat: 18, method: "plan" },
    { id: 4, name: "Mixed Green Salad", servings: 1, calories: 85, protein: 3, carbs: 8, fat: 5, method: "search" },
  ],
  Dinner: [],
  Snacks: [
    { id: 5, name: "Protein Bar", servings: 1, calories: 200, protein: 20, carbs: 22, fat: 7, method: "quick" },
    { id: 6, name: "2 eggs and toast with butter", servings: 1, calories: 310, protein: 16, carbs: 28, fat: 14, method: "text" },
  ],
};

const dates = [
  "Jul 4, 2026",
  "Jul 5, 2026",
  "Jul 6, 2026",
];

export default function JournalPage() {
  const [dateIdx, setDateIdx] = useState(2);

  const allEntries = Object.values(journalData).flat();
  const totalCal = allEntries.reduce((s, e) => s + e.calories, 0);
  const totalProtein = allEntries.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = allEntries.reduce((s, e) => s + e.carbs, 0);
  const totalFat = allEntries.reduce((s, e) => s + e.fat, 0);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Food Journal</h1>
      </div>

      {/* Date navigator */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDateIdx((i) => Math.max(0, i - 1))}
            disabled={dateIdx === 0}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-base font-semibold text-gray-900 w-32 text-center">{dates[dateIdx]}</span>
          <button
            onClick={() => setDateIdx((i) => Math.min(dates.length - 1, i + 1))}
            disabled={dateIdx === dates.length - 1}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {dateIdx < dates.length - 1 && (
            <button
              onClick={() => setDateIdx(dates.length - 1)}
              className="text-sm text-brand-600 font-medium hover:text-brand-700"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Daily summary strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Calories", value: totalCal, unit: "kcal", target: 2200, color: "text-green-600" },
          { label: "Protein", value: totalProtein, unit: "g", target: 165, color: "text-blue-600" },
          { label: "Carbs", value: totalCarbs, unit: "g", target: 220, color: "text-amber-600" },
          { label: "Fat", value: totalFat, unit: "g", target: 73, color: "text-rose-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400">/ {s.target} {s.unit}</p>
          </div>
        ))}
      </div>

      {/* Meal slots */}
      <div className="space-y-4">
        {(["Breakfast", "Lunch", "Dinner", "Snacks"] as const).map((slot) => {
          const entries = journalData[slot] ?? [];
          const slotCal = entries.reduce((s, e) => s + e.calories, 0);
          return (
            <div
              key={slot}
              className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 ${slotBorderColor[slot]}`}
            >
              {/* Slot header */}
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{slotIcon[slot]}</span>
                  <span className="font-semibold text-gray-900">{slot}</span>
                </div>
                <span className="text-sm text-gray-500 font-medium">{slotCal} kcal</span>
              </div>

              {/* Entries */}
              {entries.length === 0 ? (
                <div className="px-5 py-4 text-sm text-gray-400 italic">No entries yet</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {entries.map((entry) => (
                    <div key={entry.id} className="px-5 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{entry.name}</span>
                          {entry.servings !== 1 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              ×{entry.servings}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${methodBadge[entry.method].className}`}>
                            {methodBadge[entry.method].label}
                          </span>
                        </div>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs font-medium text-gray-600">{entry.calories} kcal</span>
                          <span className="text-xs text-blue-500">P {entry.protein}g</span>
                          <span className="text-xs text-amber-500">C {entry.carbs}g</span>
                          <span className="text-xs text-rose-500">F {entry.fat}g</span>
                        </div>
                      </div>
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
              )}

              {/* Add row */}
              <button className="w-full px-5 py-3 border-t border-dashed border-gray-200 text-sm text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add to {slot}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
