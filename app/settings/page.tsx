"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import TabSwitcher from "@/components/shared/TabSwitcher";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type SettingsTab = "profile" | "nutrition" | "preferences";

const CUISINES = ["Italian", "Asian", "Mexican", "Mediterranean", "American", "Indian", "Japanese", "Thai", "Greek", "French"];
const RESTRICTIONS = ["Vegan", "Vegetarian", "Gluten-Free", "Dairy-Free", "Keto", "Paleo", "Nut-Free", "Low-Carb"];
const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Lightly Active" },
  { value: "moderate", label: "Moderately Active" },
  { value: "active", label: "Very Active" },
  { value: "very_active", label: "Extremely Active" },
];

function calcMacros(calories: number, proteinPct: number, carbsPct: number, fatPct: number) {
  return {
    protein: Math.round((calories * (proteinPct / 100)) / 4),
    carbs: Math.round((calories * (carbsPct / 100)) / 4),
    fat: Math.round((calories * (fatPct / 100)) / 9),
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allergyInput, setAllergyInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    age: "28",
    sex: "male",
    heightFt: "5",
    heightIn: "11",
    weightLbs: "185",
    activityLevel: "moderate",
    goal: "lose",
    targetRate: "1.0",
  });

  const [calories, setCalories] = useState(2200);
  const [proteinPct, setProteinPct] = useState(30);
  const [carbsPct, setCarbsPct] = useState(45);
  const [fatPct, setFatPct] = useState(25);

  const [prefs, setPrefs] = useState({
    cuisines: [] as string[],
    restrictions: [] as string[],
    allergies: [] as string[],
    mealStructure: "3_plus_snacks",
  });

  // Load profile on mount
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("*").single(),
    ]).then(([{ data: { user } }, { data: prof }]) => {
      if (user) {
        setUserId(user.id);
        setProfile((p) => ({
          ...p,
          email: user.email ?? "",
          name: prof?.display_name ?? "",
          sex: prof?.sex ?? "male",
          activityLevel: prof?.activity_level ?? "moderate",
          goal: prof?.goal ?? "lose",
        }));
      }
      if (prof) {
        if (prof.height_cm) {
          const totalInches = prof.height_cm / 2.54;
          setProfile((p) => ({
            ...p,
            heightFt: String(Math.floor(totalInches / 12)),
            heightIn: String(Math.round(totalInches % 12)),
          }));
        }
        if (prof.birth_date) {
          const age = new Date().getFullYear() - new Date(prof.birth_date).getFullYear();
          setProfile((p) => ({ ...p, age: String(age) }));
        }
        if (prof.calorie_target) setCalories(prof.calorie_target);
        if (prof.protein_g && prof.calorie_target) setProteinPct(Math.round((prof.protein_g * 4 / prof.calorie_target) * 100));
        if (prof.carbs_g && prof.calorie_target) setCarbsPct(Math.round((prof.carbs_g * 4 / prof.calorie_target) * 100));
        if (prof.fat_g && prof.calorie_target) setFatPct(Math.round((prof.fat_g * 9 / prof.calorie_target) * 100));
        setPrefs({
          cuisines: prof.cuisines ?? [],
          restrictions: prof.dietary_restrictions ?? [],
          allergies: prof.allergies ?? [],
          mealStructure: prof.meal_structure ?? "3_plus_snacks",
        });
      }
      setLoading(false);
    });
  }, []);

  const macros = calcMacros(calories, proteinPct, carbsPct, fatPct);
  const totalPct = proteinPct + carbsPct + fatPct;

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const supabase = createClient();
    const heightCm = ((parseInt(profile.heightFt) || 5) * 12 + (parseInt(profile.heightIn) || 0)) * 2.54;
    const birthYear = new Date().getFullYear() - (parseInt(profile.age) || 28);

    await supabase.from("profiles").update({
      display_name: profile.name || null,
      goal: profile.goal,
      activity_level: profile.activityLevel,
      sex: profile.sex,
      height_cm: heightCm,
      birth_date: `${birthYear}-01-01`,
      calorie_target: calories,
      protein_g: macros.protein,
      carbs_g: macros.carbs,
      fat_g: macros.fat,
      cuisines: prefs.cuisines,
      dietary_restrictions: prefs.restrictions,
      allergies: prefs.allergies,
      meal_structure: prefs.mealStructure,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading settings...</div>
      </div>
    );
  }

  const toggleCuisine = (c: string) =>
    setPrefs((p) => ({ ...p, cuisines: p.cuisines.includes(c) ? p.cuisines.filter((x) => x !== c) : [...p.cuisines, c] }));

  const toggleRestriction = (r: string) =>
    setPrefs((p) => ({ ...p, restrictions: p.restrictions.includes(r) ? p.restrictions.filter((x) => x !== r) : [...p.restrictions, r] }));

  const addAllergy = () => {
    const t = allergyInput.trim();
    if (t && !prefs.allergies.includes(t)) {
      setPrefs((p) => ({ ...p, allergies: [...p.allergies, t] }));
      setAllergyInput("");
    }
  };

  const tabs: { value: SettingsTab; label: string }[] = [
    { value: "profile", label: "Profile" },
    { value: "nutrition", label: "Nutrition Targets" },
    { value: "preferences", label: "Preferences" },
  ];

  const savedIndicator = saved ? (
    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      Saved!
    </div>
  ) : null;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title="Settings">{savedIndicator}</PageHeader>

      <TabSwitcher tabs={tabs} value={tab} onChange={setTab} fullWidth scrollable className="mb-6" />

      {/* Profile tab */}
      {tab === "profile" && (
        <Card className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Age</label>
              <input
                type="number"
                value={profile.age}
                onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sex</label>
              <div className="flex gap-2">
                {(["male", "female"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setProfile((p) => ({ ...p, sex: s }))}
                    className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors capitalize ${
                      profile.sex === s ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Height</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={profile.heightFt}
                  onChange={(e) => setProfile((p) => ({ ...p, heightFt: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-gray-400 text-sm flex-shrink-0">ft</span>
                <input
                  type="number"
                  value={profile.heightIn}
                  onChange={(e) => setProfile((p) => ({ ...p, heightIn: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-gray-400 text-sm flex-shrink-0">in</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Weight (lbs)</label>
              <input
                type="number"
                value={profile.weightLbs}
                onChange={(e) => setProfile((p) => ({ ...p, weightLbs: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Activity Level</label>
            <select
              value={profile.activityLevel}
              onChange={(e) => setProfile((p) => ({ ...p, activityLevel: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Goal</label>
              <select
                value={profile.goal}
                onChange={(e) => setProfile((p) => ({ ...p, goal: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="lose">Lose Weight</option>
                <option value="maintain">Maintain Weight</option>
                <option value="gain">Build Muscle</option>
              </select>
            </div>
            {profile.goal !== "maintain" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Rate</label>
                <select
                  value={profile.targetRate}
                  onChange={(e) => setProfile((p) => ({ ...p, targetRate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="0.5">0.5 lbs/week</option>
                  <option value="1.0">1.0 lbs/week</option>
                  <option value="1.5">1.5 lbs/week</option>
                  <option value="2.0">2.0 lbs/week</option>
                </select>
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving} fullWidth size="lg">{saving ? "Saving..." : "Save Changes"}</Button>
        </Card>
      )}

      {/* Nutrition Targets tab */}
      {tab === "nutrition" && (
        <div className="space-y-4">
          <Card className="p-6 space-y-5">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-medium text-gray-700">Daily Calories</label>
                <span className="text-sm font-bold text-gray-900">{calories} kcal</span>
              </div>
              <input
                type="range"
                min="1200"
                max="4000"
                step="50"
                value={calories}
                onChange={(e) => setCalories(parseInt(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1200</span>
                <span>4000 kcal</span>
              </div>
            </div>

            <div className={`text-xs font-medium px-3 py-2 rounded-lg ${totalPct === 100 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              Macro split: {totalPct}% — {totalPct === 100 ? "✓ Balanced" : `${totalPct > 100 ? "over" : "under"} by ${Math.abs(100 - totalPct)}%`}
            </div>

            {[
              { label: "Protein", value: proteinPct, set: setProteinPct, color: "accent-blue-600", textColor: "text-blue-600", grams: macros.protein },
              { label: "Carbohydrates", value: carbsPct, set: setCarbsPct, color: "accent-amber-500", textColor: "text-amber-600", grams: macros.carbs },
              { label: "Fat", value: fatPct, set: setFatPct, color: "accent-rose-500", textColor: "text-rose-600", grams: macros.fat },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium text-gray-700">{m.label}</label>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${m.textColor}`}>{m.value}%</span>
                    <span className="text-xs text-gray-400">= {m.grams}g</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="5"
                  max="70"
                  step="1"
                  value={m.value}
                  onChange={(e) => m.set(parseInt(e.target.value))}
                  className={`w-full ${m.color}`}
                />
              </div>
            ))}

            {/* Live macro breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
              {[
                { label: "Calories", value: calories, unit: "kcal", color: "bg-green-500" },
                { label: "Protein", value: macros.protein, unit: "g", color: "bg-blue-500" },
                { label: "Carbs", value: macros.carbs, unit: "g", color: "bg-amber-500" },
                { label: "Fat", value: macros.fat, unit: "g", color: "bg-rose-500" },
              ].map((m) => (
                <div key={m.label} className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className={`w-2 h-2 rounded-full ${m.color} mx-auto mb-1`} />
                  <p className="text-xs text-gray-500">{m.label}</p>
                  <p className="font-bold text-gray-900 text-sm">{m.value}</p>
                  <p className="text-xs text-gray-400">{m.unit}</p>
                </div>
              ))}
            </div>

            <Button onClick={handleSave} disabled={saving} fullWidth size="lg">{saving ? "Saving..." : "Save Targets"}</Button>
          </Card>
        </div>
      )}

      {/* Preferences tab */}
      {tab === "preferences" && (
        <Card className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Favorite cuisines</label>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCuisine(c)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    prefs.cuisines.includes(c)
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
                  onClick={() => toggleRestriction(r)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    prefs.restrictions.includes(r)
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
                placeholder="Add allergy..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button onClick={addAllergy}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {prefs.allergies.map((a) => (
                <span key={a} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm text-red-700">
                  {a}
                  <button
                    onClick={() => setPrefs((p) => ({ ...p, allergies: p.allergies.filter((x) => x !== a) }))}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { value: "3_meals", label: "3 Meals", sub: "Breakfast, lunch, dinner" },
                { value: "3_plus_snacks", label: "3 + Snacks", sub: "Meals with snacks" },
                { value: "if", label: "Intermittent Fasting", sub: "8h eating window" },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPrefs((p) => ({ ...p, mealStructure: m.value }))}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    prefs.mealStructure === m.value ? "border-brand-600 bg-brand-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className={`text-sm font-semibold ${prefs.mealStructure === m.value ? "text-brand-700" : "text-gray-800"}`}>{m.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.sub}</p>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} fullWidth size="lg">{saving ? "Saving..." : "Save Preferences"}</Button>
        </Card>
      )}

      {/* Sign out — always visible */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}
