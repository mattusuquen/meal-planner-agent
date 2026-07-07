"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Goal = "lose" | "maintain" | "gain";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type MealStructure = "3_meals" | "3_plus_snacks" | "if";

interface OnboardingData {
  goal: Goal;
  targetRate: number;
  age: string;
  sex: "male" | "female";
  heightFt: string;
  heightIn: string;
  weightLbs: string;
  activityLevel: ActivityLevel;
  cuisines: string[];
  restrictions: string[];
  allergies: string[];
  mealStructure: MealStructure;
}

const CUISINES = ["Italian", "Asian", "Mexican", "Mediterranean", "American", "Indian", "Japanese", "Thai", "Greek", "French"];
const RESTRICTIONS = ["Vegan", "Vegetarian", "Gluten-Free", "Dairy-Free", "Keto", "Paleo", "Nut-Free", "Low-Carb"];
const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: "sedentary", label: "Sedentary", description: "Little or no exercise" },
  { value: "light", label: "Lightly Active", description: "1–3 days/week" },
  { value: "moderate", label: "Moderately Active", description: "3–5 days/week" },
  { value: "active", label: "Very Active", description: "6–7 days/week" },
  { value: "very_active", label: "Extremely Active", description: "Physical job + exercise" },
];

function calcTDEE(data: OnboardingData) {
  const age = parseInt(data.age) || 28;
  const weight = (parseFloat(data.weightLbs) || 185) * 0.453592;
  const heightCm = ((parseInt(data.heightFt) || 5) * 12 + (parseInt(data.heightIn) || 11)) * 2.54;
  const bmr =
    data.sex === "male"
      ? 10 * weight + 6.25 * heightCm - 5 * age + 5
      : 10 * weight + 6.25 * heightCm - 5 * age - 161;
  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const tdee = Math.round(bmr * multipliers[data.activityLevel]);
  const deficit = data.goal === "lose" ? data.targetRate * 500 : data.goal === "gain" ? -(data.targetRate * 500) : 0;
  const calories = Math.round(tdee - deficit);
  const protein = Math.round((calories * 0.3) / 4);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories * 0.45) / 4);
  return { tdee, calories, protein, fat, carbs };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [allergyInput, setAllergyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    goal: "lose",
    targetRate: 1,
    age: "28",
    sex: "male",
    heightFt: "5",
    heightIn: "11",
    weightLbs: "185",
    activityLevel: "moderate",
    cuisines: [],
    restrictions: [],
    allergies: [],
    mealStructure: "3_plus_snacks",
  });

  const macros = calcTDEE(data);

  const toggle = (key: "cuisines" | "restrictions", value: string) => {
    setData((d) => ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
    }));
  };

  const addAllergy = () => {
    const trimmed = allergyInput.trim();
    if (trimmed && !data.allergies.includes(trimmed)) {
      setData((d) => ({ ...d, allergies: [...d.allergies, trimmed] }));
      setAllergyInput("");
    }
  };

  const GOAL_CARDS: { value: Goal; label: string; icon: string; description: string }[] = [
    { value: "lose", label: "Lose Weight", icon: "📉", description: "Reduce body fat with a calorie deficit" },
    { value: "maintain", label: "Maintain Weight", icon: "⚖️", description: "Eat at maintenance to stay steady" },
    { value: "gain", label: "Build Muscle", icon: "💪", description: "Gain lean mass with a calorie surplus" },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start py-12 px-4">
      {/* Step indicator */}
      {step > 1 && (
        <div className="flex items-center gap-2 mb-10">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  s < step
                    ? "bg-brand-600 text-white"
                    : s === step
                    ? "bg-brand-600 text-white ring-4 ring-brand-100"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {s < step ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s
                )}
              </div>
              {s < 5 && <div className={`w-10 h-0.5 ${s < step ? "bg-brand-600" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-xl">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome to Meal Planner</h1>
              <p className="mt-3 text-gray-500 text-lg leading-relaxed">
                AI-powered meal planning with nutrition accuracy backed by the USDA FoodData Central database — not estimated macros.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              {[
                { icon: "🎯", label: "Personalized plans" },
                { icon: "📊", label: "Accurate macros" },
                { icon: "🤖", label: "AI agent" },
              ].map((f) => (
                <div key={f.label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">{f.icon}</div>
                  <p className="text-xs font-medium text-gray-600">{f.label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 bg-brand-600 text-white rounded-xl font-semibold text-base hover:bg-brand-700 transition-colors"
            >
              Get Started
            </button>
          </div>
        )}

        {/* Step 2: Goals */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">What&apos;s your goal?</h2>
              <p className="text-gray-500 mt-1">We&apos;ll calculate your daily calorie and macro targets.</p>
            </div>
            <div className="space-y-3">
              {GOAL_CARDS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setData((d) => ({ ...d, goal: g.value }))}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    data.goal === g.value
                      ? "border-brand-600 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <span className="text-3xl">{g.icon}</span>
                  <div>
                    <p className={`font-semibold ${data.goal === g.value ? "text-brand-700" : "text-gray-900"}`}>
                      {g.label}
                    </p>
                    <p className="text-sm text-gray-500">{g.description}</p>
                  </div>
                  {data.goal === g.value && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {data.goal !== "maintain" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Target rate: <span className="text-brand-600 font-semibold">{data.targetRate} lbs/week</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.5"
                  value={data.targetRate}
                  onChange={(e) => setData((d) => ({ ...d, targetRate: parseFloat(e.target.value) }))}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0.5 lbs/wk</span>
                  <span>1.0 lbs/wk</span>
                  <span>1.5 lbs/wk</span>
                  <span>2.0 lbs/wk</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Biometrics */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Your biometrics</h2>
              <p className="text-gray-500 mt-1">Used to calculate your TDEE accurately.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Age</label>
                <input
                  type="number"
                  value={data.age}
                  onChange={(e) => setData((d) => ({ ...d, age: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="28"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sex</label>
                <div className="flex gap-2">
                  {(["male", "female"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setData((d) => ({ ...d, sex: s }))}
                      className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors capitalize ${
                        data.sex === s
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Height</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={data.heightFt}
                    onChange={(e) => setData((d) => ({ ...d, heightFt: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="5"
                  />
                  <span className="text-gray-400 self-center text-sm">ft</span>
                  <input
                    type="number"
                    value={data.heightIn}
                    onChange={(e) => setData((d) => ({ ...d, heightIn: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="11"
                  />
                  <span className="text-gray-400 self-center text-sm">in</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Weight (lbs)</label>
                <input
                  type="number"
                  value={data.weightLbs}
                  onChange={(e) => setData((d) => ({ ...d, weightLbs: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="185"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Activity level</label>
              <div className="space-y-2">
                {ACTIVITY_LEVELS.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setData((d) => ({ ...d, activityLevel: a.value }))}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all text-left ${
                      data.activityLevel === a.value
                        ? "border-brand-600 bg-brand-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div>
                      <span className={`text-sm font-medium ${data.activityLevel === a.value ? "text-brand-700" : "text-gray-900"}`}>
                        {a.label}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">{a.description}</span>
                    </div>
                    {data.activityLevel === a.value && (
                      <div className="w-4 h-4 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Dietary Preferences */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Dietary preferences</h2>
              <p className="text-gray-500 mt-1">Personalize your meal plans to your taste.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Favorite cuisines</label>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggle("cuisines", c)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      data.cuisines.includes(c)
                        ? "bg-brand-600 border-brand-600 text-white"
                        : "border-gray-200 text-gray-600 hover:border-brand-400"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dietary restrictions</label>
              <div className="flex flex-wrap gap-2">
                {RESTRICTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => toggle("restrictions", r)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      data.restrictions.includes(r)
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "border-gray-200 text-gray-600 hover:border-amber-400"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={allergyInput}
                  onChange={(e) => setAllergyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addAllergy()}
                  placeholder="e.g. peanuts"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={addAllergy}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.allergies.map((a) => (
                  <span key={a} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm text-red-700">
                    {a}
                    <button
                      onClick={() => setData((d) => ({ ...d, allergies: d.allergies.filter((x) => x !== a) }))}
                      className="ml-0.5 hover:text-red-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Meal structure</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "3_meals", label: "3 Meals", sub: "Breakfast, lunch, dinner" },
                  { value: "3_plus_snacks", label: "3 + Snacks", sub: "Meals with snacks" },
                  { value: "if", label: "Intermittent Fasting", sub: "8h eating window" },
                ] as { value: MealStructure; label: string; sub: string }[]).map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setData((d) => ({ ...d, mealStructure: m.value }))}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      data.mealStructure === m.value
                        ? "border-brand-600 bg-brand-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${data.mealStructure === m.value ? "text-brand-700" : "text-gray-800"}`}>
                      {m.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Your plan is ready</h2>
              <p className="text-gray-500 mt-1">Here&apos;s your calculated TDEE and daily macro targets.</p>
            </div>

            {/* Macro targets */}
            <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">TDEE (maintenance)</span>
                <span className="font-semibold text-gray-800">{macros.tdee} kcal</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Daily Calories", value: `${macros.calories}`, unit: "kcal", color: "bg-green-500" },
                  { label: "Protein", value: `${macros.protein}`, unit: "g", color: "bg-blue-500" },
                  { label: "Carbs", value: `${macros.carbs}`, unit: "g", color: "bg-amber-500" },
                  { label: "Fat", value: `${macros.fat}`, unit: "g", color: "bg-rose-500" },
                ].map((m) => (
                  <div key={m.label} className="bg-white rounded-xl p-3 flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${m.color} flex-shrink-0`} />
                    <div>
                      <p className="text-xs text-gray-500">{m.label}</p>
                      <p className="font-bold text-gray-900">
                        {m.value} <span className="text-xs font-normal text-gray-500">{m.unit}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2 text-sm">
              {[
                { label: "Goal", value: data.goal === "lose" ? `Lose ${data.targetRate} lbs/week` : data.goal === "gain" ? `Gain ${data.targetRate} lbs/week` : "Maintain weight" },
                { label: "Activity", value: ACTIVITY_LEVELS.find((a) => a.value === data.activityLevel)?.label ?? "" },
                { label: "Restrictions", value: data.restrictions.length > 0 ? data.restrictions.join(", ") : "None" },
                { label: "Allergies", value: data.allergies.length > 0 ? data.allergies.join(", ") : "None" },
                { label: "Meal structure", value: data.mealStructure === "3_meals" ? "3 Meals" : data.mealStructure === "3_plus_snacks" ? "3 Meals + Snacks" : "Intermittent Fasting" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-medium text-gray-800 text-right max-w-48 truncate">{row.value}</span>
                </div>
              ))}
            </div>

            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const supabase = createClient();
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) { router.push("/auth/login"); return; }

                  const age = parseInt(data.age) || 28;
                  const weightKg = (parseFloat(data.weightLbs) || 185) * 0.453592;
                  const heightCm = ((parseInt(data.heightFt) || 5) * 12 + (parseInt(data.heightIn) || 0)) * 2.54;
                  const birthYear = new Date().getFullYear() - age;
                  const birthDate = `${birthYear}-01-01`;

                  await supabase.from("profiles").update({
                    goal: data.goal,
                    activity_level: data.activityLevel,
                    height_cm: heightCm,
                    birth_date: birthDate,
                    sex: data.sex,
                    calorie_target: macros.calories,
                    protein_g: macros.protein,
                    carbs_g: macros.carbs,
                    fat_g: macros.fat,
                    dietary_restrictions: data.restrictions,
                    allergies: data.allergies,
                    cuisines: data.cuisines,
                    meal_structure: data.mealStructure,
                    onboarding_complete: true,
                    updated_at: new Date().toISOString(),
                  }).eq("id", user.id);

                  router.push("/dashboard");
                } catch {
                  setSaving(false);
                }
              }}
              className="w-full py-3.5 bg-brand-600 text-white rounded-xl font-semibold text-base hover:bg-brand-700 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving..." : "Start Planning →"}
            </button>
          </div>
        )}

        {/* Nav buttons */}
        {step > 1 && (
          <div className="flex justify-between mt-8">
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
            {step < 5 && (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Next →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
