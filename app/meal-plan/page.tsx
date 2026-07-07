"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import FadeIn from "@/components/ui/FadeIn";
import MacroRingCard from "@/components/shared/MacroRingCard";
import type { MealPlan, MealCell, Profile } from "@/lib/types";

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;
type Slot = (typeof SLOTS)[number];

const SLOT_TIMES: Record<string, string> = {
  Breakfast: "7:30 AM",
  Lunch: "12:30 PM",
  Dinner: "6:30 PM",
  Snacks: "Throughout the Day",
};

const slotKcalColor: Record<string, string> = {
  Breakfast: "text-amber-500",
  Lunch: "text-blue-500",
  Dinner: "text-green-600",
  Snacks: "text-purple-600",
};

function SlotIcon({ slot }: { slot: string }) {
  if (slot === "Breakfast") {
    return (
      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }
  if (slot === "Lunch") {
    return (
      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }
  if (slot === "Dinner") {
    return (
      <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      </div>
    );
  }
  // Snacks
  return (
    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
        />
      </svg>
    </div>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

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
  return date.toLocaleDateString("en-CA");
}

function getWeekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toISO(addDays(monday, i)));
}

function formatDay(isoDate: string): { short: string; num: string } {
  const d = new Date(isoDate + "T12:00:00");
  return {
    short: d.toLocaleDateString("en-US", { weekday: "short" }),
    num: d.toLocaleDateString("en-US", { day: "numeric" }),
  };
}

function formatWeekLabel(monday: Date): string {
  const end = addDays(monday, 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(monday).replace(`, ${monday.getFullYear()}`, "")} – ${fmt(end)}`;
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 mt-4">
      {/* Ring skeletons */}
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col items-center gap-2"
          >
            <Skeleton className="w-20 h-20 rounded-full" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
      {/* Day tabs skeleton */}
      <div className="flex gap-1.5 overflow-hidden">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="flex-shrink-0 w-[52px] h-14 rounded-xl" />
        ))}
      </div>
      {/* Meal cards skeleton */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="w-7 h-7 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <div className="h-px bg-gray-100 mb-3" />
          <div className="flex gap-3">
            <Skeleton className="w-28 h-24 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/6" />
            </div>
            <Skeleton className="w-24 h-24 rounded-xl flex-shrink-0 hidden md:block" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MealPlanPage() {
  const router = useRouter();
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [swappingKey, setSwappingKey] = useState<string | null>(null);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [savedSlotKeys, setSavedSlotKeys] = useState<Set<string>>(new Set());
  const [savingSlotKey, setSavingSlotKey] = useState<string | null>(null);
  const [selectedMealModal, setSelectedMealModal] = useState<{
    slot: Slot;
    meal: MealCell;
    imageUrl: string | null;
    slotKey: string;
  } | null>(null);
  const [mealImages, setMealImages] = useState<Record<string, string>>({});
  const pendingImages = useRef<Set<string>>(new Set());

  const [mobileDayIdx, setMobileDayIdx] = useState(() => {
    const today = new Date();
    const todayMonday = getMonday(today);
    const diff = Math.floor((today.getTime() - todayMonday.getTime()) / 86400000);
    return Math.max(0, Math.min(6, diff));
  });

  const weekStart = toISO(monday);
  const days = getWeekDays(monday);
  const selectedDayIso = days[mobileDayIdx];

  // Fetch profile once
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile: p }) => {
        if (p) setProfile(p);
      });
  }, []);

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

  // Fire image generation for selected day's meals
  useEffect(() => {
    if (!plan) return;
    const planId = plan.id;
    const dayIso = selectedDayIso;

    SLOTS.forEach((slot) => {
      const meal = plan.plan[dayIso]?.[slot] as MealCell | null;
      if (!meal) return;
      const key = `${dayIso}-${slot}`;
      // Skip if already have an image (from DB or previous generation) or in-flight
      if (meal.image_url || mealImages[key] || pendingImages.current.has(key)) return;

      pendingImages.current.add(key);
      fetch("/api/plan/meal-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, day: dayIso, slot }),
      })
        .then((r) => r.json())
        .then((data: { image_url?: string; error?: string }) => {
          if (data.image_url) {
            // Update local display cache
            setMealImages((prev) => ({ ...prev, [key]: data.image_url! }));
            // Also write back into plan state so switching days and back keeps the image
            // (only for storage-backed URLs, not data URIs — data URIs are too large to hold in plan state)
            if (!data.image_url!.startsWith("data:")) {
              setPlan((prev) => {
                if (!prev) return prev;
                const dayData = prev.plan[dayIso];
                if (!dayData?.[slot]) return prev;
                return {
                  ...prev,
                  plan: {
                    ...prev.plan,
                    [dayIso]: {
                      ...dayData,
                      [slot]: { ...(dayData[slot] as MealCell), image_url: data.image_url },
                    },
                  },
                };
              });
            }
          } else if (data.error) {
            console.warn(`[meal-image] ${slot} failed:`, data.error);
          }
        })
        .catch((err) => console.error("[meal-image] fetch error:", err))
        .finally(() => pendingImages.current.delete(key));
    });
  }, [plan, selectedDayIso]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setMealImages({});
      pendingImages.current.clear();
    }
    setGenerating(false);
  };

  const handleSwap = async (day: string, slot: string) => {
    if (!plan) return;
    const key = `${day}-${slot}`;
    setSwappingKey(key);

    // Clear stale image so a fresh one is generated after swap
    setMealImages((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    pendingImages.current.delete(key);

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

  const handleSaveRecipe = async (slotKey: string, meal: MealCell) => {
    setSavingSlotKey(slotKey);
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: meal.name,
        calories: meal.calories,
        protein_g: meal.protein,
        carbs_g: meal.carbs,
        fat_g: meal.fat,
        ingredients: meal.ingredients ?? [],
        instructions: meal.instructions ?? [],
        servings: 1,
      }),
    });
    if (res.ok) {
      setSavedSlotKeys((prev) => new Set([...prev, slotKey]));
    }
    setSavingSlotKey(null);
  };

  // ── Derived stats ────────────────────────────────────────────────────────────

  const goalTags = useMemo(() => {
    if (!profile) return [] as string[];
    const tags: string[] = [];
    if (profile.goal === "gain") tags.push("High-Calorie", "High-Protein");
    else if (profile.goal === "lose") tags.push("Calorie-Deficit", "High-Protein");
    else tags.push("Balanced");
    if (profile.dietary_restrictions?.some((r) => /gut|fodmap/i.test(r)))
      tags.push("Gut-Friendly");
    if (profile.dietary_restrictions?.includes("gluten-free")) tags.push("Gluten-Free");
    if (profile.dietary_restrictions?.includes("vegan")) tags.push("Plant-Based");
    return tags;
  }, [profile]);

  // Planned totals for the selected day
  const dayTotals = useMemo(() => {
    if (!plan) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return SLOTS.reduce(
      (acc, slot) => {
        const meal = plan.plan[selectedDayIso]?.[slot] as MealCell | null;
        if (!meal) return acc;
        return {
          calories: acc.calories + (meal.calories ?? 0),
          protein: acc.protein + (meal.protein ?? 0),
          carbs: acc.carbs + (meal.carbs ?? 0),
          fat: acc.fat + (meal.fat ?? 0),
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [plan, selectedDayIso]);

  const getImage = (slot: string): string | null => {
    const meal = plan?.plan[selectedDayIso]?.[slot] as MealCell | null;
    if (!meal) return null;
    return meal.image_url || mealImages[`${selectedDayIso}-${slot}`] || null;
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 md:p-6 pb-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                Your Weekly Meal Plan
              </h1>
            </div>
            {goalTags.length > 0 && (
              <p className="text-sm text-brand-600 font-medium pl-8">
                {goalTags.join(" • ")}
              </p>
            )}
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm flex-shrink-0">
            <svg
              className="w-4 h-4 text-gray-400 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs font-medium text-gray-700 whitespace-nowrap hidden sm:inline">
              {formatWeekLabel(monday)}
            </span>
            <button
              onClick={() => setMonday((m) => addDays(m, -7))}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 ml-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={() => setMonday((m) => addDays(m, 7))}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* ── Macro progress rings ── */}
            {profile && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                <MacroRingCard
                  label="Calories"
                  consumed={dayTotals.calories}
                  target={profile.calorie_target ?? 0}
                  color="#f97316"
                  unit="kcal"
                />
                <MacroRingCard
                  label="Protein"
                  consumed={dayTotals.protein}
                  target={profile.protein_g ?? 0}
                  color="#3b82f6"
                  unit="g"
                />
                <MacroRingCard
                  label="Carbs"
                  consumed={dayTotals.carbs}
                  target={profile.carbs_g ?? 0}
                  color="#f59e0b"
                  unit="g"
                />
                <MacroRingCard
                  label="Fat"
                  consumed={dayTotals.fat}
                  target={profile.fat_g ?? 0}
                  color="#f43f5e"
                  unit="g"
                />
              </div>
            )}

            {!plan ? (
              /* ── Empty state ── */
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-brand-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-800">No plan for this week</h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Let AI generate a personalized meal plan based on your goals.
                  </p>
                </div>
                <Button onClick={handleGenerate} disabled={generating} size="lg">
                  {generating ? "Generating plan…" : "Generate Weekly Plan"}
                </Button>
              </div>
            ) : (
              <>
                {/* ── Action buttons ── */}
                <div className="flex gap-2 justify-end mb-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    }
                    onClick={() => setShowRefreshConfirm(true)}
                    disabled={generating}
                  >
                    Refresh Plan
                  </Button>
                  <Button
                    size="sm"
                    icon={
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    }
                    onClick={handleGroceryList}
                  >
                    Grocery List
                  </Button>
                </div>

                {/* ── Day tabs ── */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
                  {days.map((day, i) => {
                    const { short, num } = formatDay(day);
                    const isActive = mobileDayIdx === i;
                    return (
                      <button
                        key={day}
                        onClick={() => setMobileDayIdx(i)}
                        className={`flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-xl border-2 transition-all min-w-[52px] ${isActive
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-gray-100 bg-white text-gray-500 hover:border-gray-200"
                          }`}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide">{short}</span>
                        <span className="text-sm font-bold">{num}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ── Meal sections ── */}
                <div className="space-y-4">
                  {SLOTS.map((slot, i) => {
                    const meal = plan.plan[selectedDayIso]?.[slot] as MealCell | null;
                    const imageUrl = getImage(slot);
                    const isSwapping = swappingKey === `${selectedDayIso}-${slot}`;
                    const slotKey = `${selectedDayIso}-${slot}`;

                    if (!meal) {
                      return (
                        <FadeIn key={slot} delay={i * 60}>
                          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-5 flex items-center gap-3">
                            <SlotIcon slot={slot} />
                            <span className={`font-semibold text-sm ${slotKcalColor[slot]}`}>
                              {slot}
                            </span>
                            <span className="text-sm text-gray-300">No meal planned</span>
                          </div>
                        </FadeIn>
                      );
                    }

                    return (
                      <FadeIn key={slot} delay={i * 60}>
                        <div
                          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setSelectedMealModal({ slot, meal, imageUrl, slotKey })}
                        >
                          {/* Section header */}
                          <div className="flex items-center justify-between px-4 pt-4 pb-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <SlotIcon slot={slot} />
                              <span className="font-semibold text-gray-900">{slot}</span>
                              <span className="text-gray-400 text-sm hidden sm:inline">
                                {SLOT_TIMES[slot]}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-semibold flex-shrink-0">
                              <span className={slotKcalColor[slot]}>{meal.calories} kcal</span>
                              <span className="text-gray-200">•</span>
                              <span className="text-orange-400">{meal.protein}g protein</span>
                            </div>
                          </div>

                          <div className="h-px bg-gray-100 mx-4" />

                          {/* Content */}
                          <div className="p-4 flex gap-3">
                            {/* Image */}
                            <div className="flex-shrink-0">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={meal.name}
                                  className="w-28 h-24 rounded-xl object-cover"
                                />
                              ) : (
                                <div className="w-28 h-24 rounded-xl bg-gray-100 animate-pulse" />
                              )}
                            </div>

                            {/* Meal info */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-2">
                                {meal.name}
                              </h3>
                              {meal.ingredients && meal.ingredients.length > 0 ? (
                                <ul className="space-y-0.5">
                                  {meal.ingredients.slice(0, 4).map((ing, j) => (
                                    <li
                                      key={j}
                                      className="text-xs text-gray-500 flex items-start gap-1.5"
                                    >
                                      <span className="text-gray-300 flex-shrink-0 mt-0.5">•</span>
                                      <span>{ing}</span>
                                    </li>
                                  ))}
                                  {meal.ingredients.length > 4 && (
                                    <li className="text-xs text-brand-400 pl-3">
                                      +{meal.ingredients.length - 4} more — tap to view
                                    </li>
                                  )}
                                </ul>
                              ) : (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                                    {meal.carbs}g carbs
                                  </span>
                                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                                    {meal.fat}g fat
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Description card */}
                            {meal.description && (
                              <div className="flex-shrink-0 w-24 md:w-28 bg-gray-50 rounded-xl p-2.5 self-start hidden sm:block">
                                <p className="text-xs text-gray-500 leading-relaxed">
                                  {meal.description}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Mobile description */}
                          {meal.description && (
                            <div className="px-4 pb-3 sm:hidden">
                              <p className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-xl px-3 py-2">
                                {meal.description}
                              </p>
                            </div>
                          )}

                          {/* Footer */}
                          <div className="px-4 pb-3 flex items-center justify-between">
                            <span className="text-xs text-gray-300 sm:hidden">
                              {SLOT_TIMES[slot]}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSwap(selectedDayIso, slot); }}
                              disabled={isSwapping}
                              className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 transition-colors disabled:opacity-50"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              {isSwapping ? "Swapping…" : "Swap meal"}
                            </button>
                          </div>
                        </div>
                      </FadeIn>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Meal detail modal ── */}
      {selectedMealModal && (() => {
        const { slot, meal, imageUrl, slotKey } = selectedMealModal;
        const isSaved = savedSlotKeys.has(slotKey) || !!meal.recipe_id;
        const isSaving = savingSlotKey === slotKey;
        return (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedMealModal(null)}
          >
            <div
              className="bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image */}
              {imageUrl ? (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt={meal.name}
                    className="w-full h-52 object-cover sm:rounded-t-2xl"
                  />
                  <button
                    onClick={() => setSelectedMealModal(null)}
                    className="absolute top-3 right-3 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative w-full h-36 bg-gray-100 flex items-center justify-center sm:rounded-t-2xl">
                  <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
                  <button
                    onClick={() => setSelectedMealModal(null)}
                    className="absolute top-3 right-3 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center text-gray-600 hover:bg-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <div className="p-5">
                {/* Slot label */}
                <div className="flex items-center gap-1.5 mb-2">
                  <SlotIcon slot={slot} />
                  <span className={`text-xs font-semibold ${slotKcalColor[slot]}`}>{slot}</span>
                  <span className="text-xs text-gray-400">· {SLOT_TIMES[slot]}</span>
                </div>

                {/* Meal name */}
                <h2 className="text-xl font-bold text-gray-900 leading-tight mb-4">{meal.name}</h2>

                {/* Macros */}
                <div className="grid grid-cols-4 gap-2 mb-5">
                  <div className="bg-orange-50 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-orange-400 font-medium">Calories</p>
                    <p className="text-sm font-bold text-orange-600">{meal.calories}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-blue-400 font-medium">Protein</p>
                    <p className="text-sm font-bold text-blue-600">{meal.protein}g</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-amber-400 font-medium">Carbs</p>
                    <p className="text-sm font-bold text-amber-600">{meal.carbs}g</p>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-rose-400 font-medium">Fat</p>
                    <p className="text-sm font-bold text-rose-600">{meal.fat}g</p>
                  </div>
                </div>

                {/* Description */}
                {meal.description && (
                  <div className="mb-5">
                    <p className="text-sm text-gray-600 leading-relaxed">{meal.description}</p>
                  </div>
                )}

                {/* Ingredients */}
                {meal.ingredients && meal.ingredients.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Ingredients
                      <span className="ml-1.5 text-xs font-normal text-gray-400">({meal.ingredients.length})</span>
                    </h3>
                    <ul className="space-y-1.5">
                      {meal.ingredients.map((ing, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-gray-300 flex-shrink-0 mt-0.5">•</span>
                          <span>{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Instructions */}
                {meal.instructions && meal.instructions.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Instructions</h3>
                    <ol className="space-y-3">
                      {meal.instructions.map((step, j) => (
                        <li key={j} className="flex gap-3 text-sm text-gray-600">
                          <span className="flex-shrink-0 w-5 h-5 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center text-xs font-semibold">
                            {j + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Favorite / Save action */}
                {isSaved ? (
                  <div className="flex items-center justify-center gap-2 py-3 px-4 bg-green-50 rounded-xl text-green-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <span className="text-sm font-medium">Saved to your Recipes</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSaveRecipe(slotKey, meal)}
                      disabled={isSaving}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 text-white rounded-xl font-medium text-sm hover:bg-brand-700 transition-colors disabled:opacity-60"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      {isSaving ? "Saving…" : "Save to Recipes"}
                    </button>
                    <p className="text-center text-xs text-gray-400">
                      Add this meal to your saved recipes for easy access
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Refresh confirm modal ── */}
      {showRefreshConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900">Refresh meal plan?</h3>
            <p className="text-sm text-gray-500 mt-2">
              This will replace your current meal plan for this week with a newly generated one.
              This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6 justify-end">
              <Button variant="secondary" onClick={() => setShowRefreshConfirm(false)}>
                Cancel
              </Button>
              <Button
                className="bg-red-500 text-white hover:bg-red-600"
                onClick={() => {
                  setShowRefreshConfirm(false);
                  handleGenerate();
                }}
                disabled={generating}
              >
                Yes, refresh
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
