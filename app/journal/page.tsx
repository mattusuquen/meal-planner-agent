"use client";

import { useRef, useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import FoodEntryRow from "@/components/shared/FoodEntryRow";
import StatsCard from "@/components/shared/StatsCard";
import AddMealModal, { LogEntry } from "@/components/journal/AddMealModal";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

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

const INITIAL_JOURNAL: Record<string, LogEntry[]> = {
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

const DATES = ["Jul 4, 2026", "Jul 5, 2026", "Jul 6, 2026"];
const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

export default function JournalPage() {
  const [dateIdx, setDateIdx] = useState(2);
  const [journal, setJournal] = useState(INITIAL_JOURNAL);
  const [modal, setModal] = useState<{ open: boolean; slot: string }>({ open: false, slot: "Breakfast" });
  const nextId = useRef(100);

  const openModal = (slot: string) => setModal({ open: true, slot });
  const closeModal = () => setModal({ open: false, slot: modal.slot });

  const handleAdd = (slot: string, entries: Omit<LogEntry, "id">[]) => {
    setJournal((prev) => ({
      ...prev,
      [slot]: [...(prev[slot] ?? []), ...entries.map((e) => ({ ...e, id: nextId.current++ }))],
    }));
  };

  const handleDelete = (slot: string, id: number) => {
    setJournal((prev) => ({ ...prev, [slot]: prev[slot].filter((e) => e.id !== id) }));
  };

  const allEntries = Object.values(journal).flat();
  const totalCal = allEntries.reduce((s, e) => s + e.calories, 0);
  const totalProtein = allEntries.reduce((s, e) => s + e.protein, 0);
  const totalCarbs = allEntries.reduce((s, e) => s + e.carbs, 0);
  const totalFat = allEntries.reduce((s, e) => s + e.fat, 0);

  return (
    <>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <PageHeader title="Food Journal">
          <Button
            onClick={() => openModal("Breakfast")}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Food
          </Button>
        </PageHeader>

        {/* Date navigator */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setDateIdx((i) => Math.max(0, i - 1))}
            disabled={dateIdx === 0}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-base font-semibold text-gray-900 w-32 text-center">{DATES[dateIdx]}</span>
          <button
            onClick={() => setDateIdx((i) => Math.min(DATES.length - 1, i + 1))}
            disabled={dateIdx === DATES.length - 1}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {dateIdx < DATES.length - 1 && (
            <button onClick={() => setDateIdx(DATES.length - 1)} className="text-sm text-brand-600 font-medium hover:text-brand-700">
              Today
            </button>
          )}
        </div>

        {/* Daily summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatsCard label="Calories" value={String(totalCal)} subtitle={`/ 2200 kcal`} valueColor="text-green-600" size="sm" />
          <StatsCard label="Protein" value={`${totalProtein}g`} subtitle="/ 165g" valueColor="text-blue-600" size="sm" />
          <StatsCard label="Carbs" value={`${totalCarbs}g`} subtitle="/ 220g" valueColor="text-amber-600" size="sm" />
          <StatsCard label="Fat" value={`${totalFat}g`} subtitle="/ 73g" valueColor="text-rose-600" size="sm" />
        </div>

        {/* Meal slots */}
        <div className="space-y-4">
          {SLOTS.map((slot) => {
            const entries = journal[slot] ?? [];
            const slotCal = entries.reduce((s, e) => s + e.calories, 0);
            return (
              <div
                key={slot}
                className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-l-4 ${slotBorderColor[slot]}`}
              >
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{slotIcon[slot]}</span>
                    <span className="font-semibold text-gray-900">{slot}</span>
                  </div>
                  <span className="text-sm text-gray-500 font-medium">{slotCal} kcal</span>
                </div>

                {entries.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400 italic">No entries yet</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {entries.map((entry) => (
                      <FoodEntryRow
                        key={entry.id}
                        name={entry.name}
                        calories={entry.calories}
                        protein={entry.protein}
                        carbs={entry.carbs}
                        fat={entry.fat}
                        method={entry.method}
                        methodBadge={methodBadge}
                        servings={entry.servings}
                        photoUrl={entry.photoUrl}
                        onDelete={() => handleDelete(slot, entry.id)}
                      />
                    ))}
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
      </div>

      {modal.open && (
        <AddMealModal slot={modal.slot} onClose={closeModal} onAdd={handleAdd} />
      )}
    </>
  );
}
