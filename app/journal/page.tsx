"use client";

import { useRef, useState } from "react";

type EntryMethod = "plan" | "recipe" | "search" | "text" | "photo" | "quick";
type AddTab = "plan" | "recipe" | "search" | "text" | "photo" | "quick";
type PhotoState = "idle" | "preview" | "analyzing" | "results";
type Confidence = "high" | "medium" | "low";

interface LogEntry {
  id: number;
  name: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  method: EntryMethod;
  photoUrl?: string;
}

interface DetectedItem {
  id: string;
  name: string;
  estimatedQty: string;
  confidence: Confidence;
  usdaMatch: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  removed: boolean;
}

// ─── Mock data ───────────────────────────────────────────────────────────────

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

const PLANNED_MEALS = [
  { id: "pm1", slot: "Dinner", name: "Salmon & Roasted Veg", calories: 560, protein: 44, carbs: 28, fat: 26 },
  { id: "pm2", slot: "Snacks", name: "Greek Yogurt", calories: 150, protein: 17, carbs: 12, fat: 3 },
];

const SAVED_RECIPES = [
  { id: "r1", name: "Grilled Chicken Bowl", calories: 620, protein: 52, carbs: 68, fat: 22, cuisine: "American" },
  { id: "r2", name: "Pasta Primavera", calories: 640, protein: 28, carbs: 88, fat: 18, cuisine: "Italian" },
  { id: "r3", name: "Acai Bowl", calories: 460, protein: 12, carbs: 72, fat: 14, cuisine: "American" },
  { id: "r4", name: "Veggie Omelette", calories: 380, protein: 28, carbs: 12, fat: 24, cuisine: "American" },
  { id: "r5", name: "Shrimp Tacos", calories: 580, protein: 38, carbs: 62, fat: 19, cuisine: "Mexican" },
  { id: "r6", name: "Teriyaki Salmon", calories: 580, protein: 48, carbs: 38, fat: 24, cuisine: "Japanese" },
];

const USDA_RESULTS = [
  { id: "u1", name: "Chicken, broilers or fryers, breast, meat only, cooked", calories: 165, protein: 31, carbs: 0, fat: 4, per: "100g" },
  { id: "u2", name: "Chicken breast, oven-roasted", calories: 147, protein: 30, carbs: 0, fat: 3, per: "100g" },
  { id: "u3", name: "Chicken, rotisserie, breast, meat only", calories: 157, protein: 29, carbs: 0, fat: 4, per: "100g" },
  { id: "u4", name: "Chicken sandwich, grilled", calories: 310, protein: 34, carbs: 28, fat: 7, per: "serving (180g)" },
];

const MOCK_DETECTIONS: DetectedItem[] = [
  {
    id: "d1",
    name: "Grilled Salmon",
    estimatedQty: "6 oz",
    confidence: "high",
    usdaMatch: "Salmon, Atlantic, farmed, cooked, dry heat",
    calories: 354,
    protein: 38,
    carbs: 0,
    fat: 22,
    removed: false,
  },
  {
    id: "d2",
    name: "Roasted Broccoli",
    estimatedQty: "1 cup",
    confidence: "high",
    usdaMatch: "Broccoli, cooked, boiled, drained, without salt",
    calories: 55,
    protein: 4,
    carbs: 11,
    fat: 1,
    removed: false,
  },
  {
    id: "d3",
    name: "White Rice",
    estimatedQty: "¾ cup",
    confidence: "medium",
    usdaMatch: "Rice, white, long-grain, regular, cooked",
    calories: 169,
    protein: 3,
    carbs: 37,
    fat: 0,
    removed: false,
  },
  {
    id: "d4",
    name: "Olive Oil Drizzle",
    estimatedQty: "1 tbsp",
    confidence: "low",
    usdaMatch: "Oil, olive, salad or cooking",
    calories: 119,
    protein: 0,
    carbs: 0,
    fat: 14,
    removed: false,
  },
];

const MOCK_PARSED: DetectedItem[] = [
  {
    id: "t1",
    name: "Scrambled Eggs",
    estimatedQty: "2 large",
    confidence: "high",
    usdaMatch: "Egg, whole, cooked, scrambled",
    calories: 182,
    protein: 13,
    carbs: 3,
    fat: 13,
    removed: false,
  },
  {
    id: "t2",
    name: "Toast",
    estimatedQty: "2 slices",
    confidence: "high",
    usdaMatch: "Bread, whole-wheat, commercially prepared",
    calories: 138,
    protein: 6,
    carbs: 26,
    fat: 2,
    removed: false,
  },
  {
    id: "t3",
    name: "Butter",
    estimatedQty: "1 tbsp",
    confidence: "medium",
    usdaMatch: "Butter, without salt",
    calories: 102,
    protein: 0,
    carbs: 0,
    fat: 12,
    removed: false,
  },
];

const DATES = ["Jul 4, 2026", "Jul 5, 2026", "Jul 6, 2026"];
const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

// ─── Confidence badge ─────────────────────────────────────────────────────────

const confidenceConfig: Record<Confidence, { label: string; className: string; dot: string }> = {
  high: { label: "High confidence", className: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  medium: { label: "Medium confidence", className: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
  low: { label: "Low confidence — please verify", className: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-400" },
};

// ─── Add Meal Modal ───────────────────────────────────────────────────────────

function AddMealModal({
  slot,
  onClose,
  onAdd,
}: {
  slot: string;
  onClose: () => void;
  onAdd: (slot: string, entries: Omit<LogEntry, "id">[]) => void;
}) {
  const [tab, setTab] = useState<AddTab>("photo");

  // Plan tab
  const [planServings, setPlanServings] = useState<Record<string, number>>({});

  // Recipe tab
  const [recipeSearch, setRecipeSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<(typeof SAVED_RECIPES)[0] | null>(null);
  const [recipeServings, setRecipeServings] = useState(1);

  // Search tab
  const [usdaQuery, setUsdaQuery] = useState("");
  const [usdaSearched, setUsdaSearched] = useState(false);
  const [selectedUsda, setSelectedUsda] = useState<(typeof USDA_RESULTS)[0] | null>(null);
  const [usdaServings, setUsdaServings] = useState(1);

  // AI Parse tab
  const [parseText, setParseText] = useState("");
  const [parseState, setParseState] = useState<"idle" | "parsing" | "results">("idle");
  const [parsedItems, setParsedItems] = useState<DetectedItem[]>([]);

  // Quick tab
  const [quickName, setQuickName] = useState("");
  const [quickCal, setQuickCal] = useState("");
  const [quickProtein, setQuickProtein] = useState("");
  const [quickCarbs, setQuickCarbs] = useState("");
  const [quickFat, setQuickFat] = useState("");

  // Photo tab
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoState, setPhotoState] = useState<PhotoState>("idle");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [detections, setDetections] = useState<DetectedItem[]>([]);

  const handleFileSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    setPhotoPreviewUrl(url);
    setPhotoState("preview");
  };

  const handleAnalyze = () => {
    setPhotoState("analyzing");
    setTimeout(() => {
      setDetections(MOCK_DETECTIONS.map((d) => ({ ...d })));
      setPhotoState("results");
    }, 2200);
  };

  const handleParse = () => {
    if (!parseText.trim()) return;
    setParseState("parsing");
    setTimeout(() => {
      setParsedItems(MOCK_PARSED.map((d) => ({ ...d })));
      setParseState("results");
    }, 1800);
  };

  const updateDetection = (id: string, field: keyof DetectedItem, value: string | number | boolean) => {
    setDetections((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const updateParsed = (id: string, field: keyof DetectedItem, value: string | number | boolean) => {
    setParsedItems((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const logDetections = (items: DetectedItem[]) => {
    const active = items.filter((d) => !d.removed);
    onAdd(
      slot,
      active.map((d) => ({
        name: `${d.name} (${d.estimatedQty})`,
        servings: 1,
        calories: d.calories,
        protein: d.protein,
        carbs: d.carbs,
        fat: d.fat,
        method: tab === "photo" ? "photo" : "text",
        photoUrl: tab === "photo" ? (photoPreviewUrl ?? undefined) : undefined,
      }))
    );
    onClose();
  };

  const TABS: { value: AddTab; label: string; icon: React.ReactNode }[] = [
    {
      value: "photo",
      label: "Photo",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      value: "plan",
      label: "From Plan",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      value: "recipe",
      label: "Recipe",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      value: "search",
      label: "Search",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      value: "text",
      label: "AI Parse",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      value: "quick",
      label: "Quick Add",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ];

  const activeItems = detections.filter((d) => !d.removed);
  const parsedActive = parsedItems.filter((d) => !d.removed);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add to {slot}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Jul 6, 2026</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 px-4 pt-3 pb-0 flex-shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                tab === t.value
                  ? "bg-brand-50 text-brand-700 border-brand-600"
                  : "text-gray-500 hover:text-gray-700 border-transparent hover:bg-gray-50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <div className="h-px bg-gray-100 flex-shrink-0" />

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── PHOTO TAB ── */}
          {tab === "photo" && (
            <div className="p-5 space-y-4">
              {photoState === "idle" && (
                <>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-all group"
                  >
                    <div className="w-14 h-14 bg-gray-100 group-hover:bg-brand-100 rounded-2xl flex items-center justify-center transition-colors">
                      <svg className="w-7 h-7 text-gray-400 group-hover:text-brand-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 group-hover:text-brand-700">Upload a photo of your meal</p>
                      <p className="text-xs text-gray-400 mt-1">AI will identify foods and estimate portions</p>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-600 shadow-sm">📷 Take photo</span>
                      <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-600 shadow-sm">🖼 Upload image</span>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-amber-700">
                      <strong>Confirmation-first:</strong> AI detection is always shown as an editable draft. You review and adjust before anything is logged.
                    </p>
                  </div>
                </>
              )}

              {photoState === "preview" && photoPreviewUrl && (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-gray-100 aspect-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreviewUrl} alt="Meal photo" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setPhotoState("idle"); setPhotoPreviewUrl(null); }}
                      className="absolute top-3 right-3 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
                    <p className="font-medium text-gray-700">What happens next:</p>
                    <p>• GPT-4o vision identifies foods and estimates portion sizes</p>
                    <p>• Each item is matched to USDA FoodData Central for accurate macros</p>
                    <p>• You review and edit before anything is logged</p>
                  </div>
                  <button
                    onClick={handleAnalyze}
                    className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Analyze with AI
                  </button>
                </div>
              )}

              {photoState === "analyzing" && (
                <div className="py-16 flex flex-col items-center gap-4">
                  <div className="relative w-16 h-16">
                    <div className="w-16 h-16 rounded-full border-4 border-gray-100" />
                    <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-800">Analyzing photo with AI…</p>
                    <p className="text-xs text-gray-400 mt-1">Identifying foods and matching to USDA database</p>
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs text-gray-400 items-start mt-2">
                    {["Detecting food items…", "Estimating portion sizes…", "Matching to USDA FoodData Central…"].map((step, i) => (
                      <div key={step} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-brand-500" : i === 1 ? "bg-amber-400" : "bg-gray-300 animate-pulse"}`} />
                        <span className={i < 2 ? "text-gray-600" : ""}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {photoState === "results" && (
                <div className="space-y-4">
                  {/* Photo thumbnail */}
                  {photoPreviewUrl && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoPreviewUrl} alt="Meal" className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Photo analyzed</p>
                        <p className="text-xs text-gray-400">{detections.filter((d) => !d.removed).length} items detected · macros from USDA</p>
                      </div>
                      <div className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Verified
                      </div>
                    </div>
                  )}

                  {/* Low confidence warning */}
                  {detections.some((d) => d.confidence === "low" && !d.removed) && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-xs text-red-700">
                        <strong>1 item flagged for review</strong> — low confidence detections are highlighted. Please verify or remove before logging.
                      </p>
                    </div>
                  )}

                  {/* Detected items */}
                  <div className="space-y-2">
                    {detections.map((item) => {
                      if (item.removed) return null;
                      const conf = confidenceConfig[item.confidence];
                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-4 space-y-3 ${item.confidence === "low" ? "border-red-200 bg-red-50/30" : "border-gray-100 bg-white"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${conf.className}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                                  {item.confidence === "low" ? "Low — verify" : item.confidence === "medium" ? "Medium" : "High"}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5 truncate">USDA: {item.usdaMatch}</p>
                            </div>
                            <button
                              onClick={() => updateDetection(item.id, "removed", true)}
                              className="p-1 rounded-lg hover:bg-red-100 text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          {/* Editable quantity */}
                          <div className="flex items-center gap-3">
                            <label className="text-xs text-gray-500 w-20 flex-shrink-0">Quantity:</label>
                            <input
                              type="text"
                              value={item.estimatedQty}
                              onChange={(e) => updateDetection(item.id, "estimatedQty", e.target.value)}
                              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                          </div>

                          {/* Macro row from USDA */}
                          <div className="flex gap-3 pt-1 border-t border-gray-100">
                            <span className="text-xs font-semibold text-gray-700">{item.calories} kcal</span>
                            <span className="text-xs text-blue-500">P {item.protein}g</span>
                            <span className="text-xs text-amber-500">C {item.carbs}g</span>
                            <span className="text-xs text-rose-500">F {item.fat}g</span>
                            <span className="text-xs text-gray-400 ml-auto">from USDA</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Totals */}
                  {activeItems.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-4">
                      <span className="text-xs font-medium text-gray-500">Meal total:</span>
                      <span className="text-sm font-bold text-gray-900">{activeItems.reduce((s, d) => s + d.calories, 0)} kcal</span>
                      <span className="text-xs text-blue-500">P {activeItems.reduce((s, d) => s + d.protein, 0)}g</span>
                      <span className="text-xs text-amber-500">C {activeItems.reduce((s, d) => s + d.carbs, 0)}g</span>
                      <span className="text-xs text-rose-500">F {activeItems.reduce((s, d) => s + d.fat, 0)}g</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── FROM PLAN TAB ── */}
          {tab === "plan" && (
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500 mb-4">Planned meals for today — tap to log with one click.</p>
              {PLANNED_MEALS.map((meal) => {
                const servings = planServings[meal.id] ?? 1;
                return (
                  <div key={meal.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{meal.slot}</span>
                          <span className="text-sm font-semibold text-gray-900">{meal.name}</span>
                        </div>
                        <div className="flex gap-3 mt-2">
                          <span className="text-xs font-semibold text-gray-700">{Math.round(meal.calories * servings)} kcal</span>
                          <span className="text-xs text-blue-500">P {Math.round(meal.protein * servings)}g</span>
                          <span className="text-xs text-amber-500">C {Math.round(meal.carbs * servings)}g</span>
                          <span className="text-xs text-rose-500">F {Math.round(meal.fat * servings)}g</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                      <span className="text-xs text-gray-500">Servings:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPlanServings((s) => ({ ...s, [meal.id]: Math.max(0.5, (s[meal.id] ?? 1) - 0.5) }))}
                          className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                        >−</button>
                        <span className="text-sm font-semibold w-6 text-center">{servings}</span>
                        <button
                          onClick={() => setPlanServings((s) => ({ ...s, [meal.id]: (s[meal.id] ?? 1) + 0.5 }))}
                          className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                        >+</button>
                      </div>
                      <button
                        onClick={() => {
                          onAdd(slot, [{ name: meal.name, servings, calories: Math.round(meal.calories * servings), protein: Math.round(meal.protein * servings), carbs: Math.round(meal.carbs * servings), fat: Math.round(meal.fat * servings), method: "plan" }]);
                          onClose();
                        }}
                        className="ml-auto px-4 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-700 transition-colors"
                      >
                        Log
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── RECIPE TAB ── */}
          {tab === "recipe" && (
            <div className="p-5 space-y-4">
              <input
                type="text"
                placeholder="Search saved recipes…"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="space-y-2">
                {SAVED_RECIPES.filter((r) => r.name.toLowerCase().includes(recipeSearch.toLowerCase())).map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => { setSelectedRecipe(recipe); setRecipeServings(1); }}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${selectedRecipe?.id === recipe.id ? "border-brand-500 bg-brand-50" : "border-gray-100 hover:border-gray-200 bg-white"}`}
                  >
                    <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-base flex-shrink-0">🍽</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${selectedRecipe?.id === recipe.id ? "text-brand-700" : "text-gray-900"}`}>{recipe.name}</p>
                      <div className="flex gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{recipe.calories} kcal</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{recipe.cuisine}</span>
                      </div>
                    </div>
                    {selectedRecipe?.id === recipe.id && (
                      <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {selectedRecipe && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">Servings:</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setRecipeServings((s) => Math.max(0.5, s - 0.5))} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">−</button>
                      <span className="text-sm font-bold w-6 text-center">{recipeServings}</span>
                      <button onClick={() => setRecipeServings((s) => s + 0.5)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">+</button>
                    </div>
                    <div className="ml-auto flex gap-3 text-xs">
                      <span className="font-bold text-gray-900">{Math.round(selectedRecipe.calories * recipeServings)} kcal</span>
                      <span className="text-blue-500">P {Math.round(selectedRecipe.protein * recipeServings)}g</span>
                      <span className="text-amber-500">C {Math.round(selectedRecipe.carbs * recipeServings)}g</span>
                      <span className="text-rose-500">F {Math.round(selectedRecipe.fat * recipeServings)}g</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SEARCH TAB ── */}
          {tab === "search" && (
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search USDA FoodData Central…"
                  value={usdaQuery}
                  onChange={(e) => setUsdaQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setUsdaSearched(true); }}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={() => setUsdaSearched(true)}
                  className="px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700"
                >
                  Search
                </button>
              </div>
              {!usdaSearched && (
                <p className="text-xs text-gray-400 text-center py-4">Search for any food to find verified USDA nutrition data</p>
              )}
              {usdaSearched && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">{USDA_RESULTS.length} results for &ldquo;{usdaQuery || "chicken"}&rdquo;</p>
                  {USDA_RESULTS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setSelectedUsda(item); setUsdaServings(1); }}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all ${selectedUsda?.id === item.id ? "border-brand-500 bg-brand-50" : "border-gray-100 hover:border-gray-200 bg-white"}`}
                    >
                      <p className={`text-xs font-semibold leading-snug ${selectedUsda?.id === item.id ? "text-brand-700" : "text-gray-800"}`}>{item.name}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs text-gray-500">{item.calories} kcal</span>
                        <span className="text-xs text-blue-400">P {item.protein}g</span>
                        <span className="text-xs text-amber-400">C {item.carbs}g</span>
                        <span className="text-xs text-rose-400">F {item.fat}g</span>
                        <span className="text-xs text-gray-300 ml-auto">per {item.per}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedUsda && (
                <div className="border-t border-gray-100 pt-4 flex items-center gap-3">
                  <span className="text-sm text-gray-600">Servings:</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setUsdaServings((s) => Math.max(0.5, s - 0.5))} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">−</button>
                    <span className="text-sm font-bold w-6 text-center">{usdaServings}</span>
                    <button onClick={() => setUsdaServings((s) => s + 0.5)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100">+</button>
                  </div>
                  <div className="ml-auto flex gap-2 text-xs">
                    <span className="font-bold text-gray-900">{Math.round(selectedUsda.calories * usdaServings)} kcal</span>
                    <span className="text-blue-500">P {Math.round(selectedUsda.protein * usdaServings)}g</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── AI PARSE TAB ── */}
          {tab === "text" && (
            <div className="p-5 space-y-4">
              {parseState !== "results" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Describe what you ate</label>
                    <textarea
                      rows={3}
                      placeholder='e.g. "2 scrambled eggs, 2 slices of whole wheat toast with butter"'
                      value={parseText}
                      onChange={(e) => setParseText(e.target.value)}
                      disabled={parseState === "parsing"}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none disabled:opacity-50"
                    />
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                    AI will parse your description into structured food items, then match each to USDA for verified macros.
                  </div>
                </>
              )}
              {parseState === "parsing" && (
                <div className="py-10 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
                  <p className="text-sm text-gray-600">Parsing your meal…</p>
                </div>
              )}
              {parseState === "results" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Parsed items — verify before logging</p>
                    <button onClick={() => setParseState("idle")} className="text-xs text-brand-600 hover:text-brand-700">Edit text</button>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 italic">&ldquo;{parseText}&rdquo;</div>
                  {parsedItems.map((item) => {
                    if (item.removed) return null;
                    const conf = confidenceConfig[item.confidence];
                    return (
                      <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${conf.className}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                                {item.confidence}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">USDA: {item.usdaMatch}</p>
                          </div>
                          <button onClick={() => updateParsed(item.id, "removed", true)} className="p-1 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-gray-500 w-20">Quantity:</label>
                          <input
                            type="text"
                            value={item.estimatedQty}
                            onChange={(e) => updateParsed(item.id, "estimatedQty", e.target.value)}
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        </div>
                        <div className="flex gap-3 pt-1 border-t border-gray-50">
                          <span className="text-xs font-semibold text-gray-700">{item.calories} kcal</span>
                          <span className="text-xs text-blue-500">P {item.protein}g</span>
                          <span className="text-xs text-amber-500">C {item.carbs}g</span>
                          <span className="text-xs text-rose-500">F {item.fat}g</span>
                          <span className="text-xs text-gray-400 ml-auto">USDA verified</span>
                        </div>
                      </div>
                    );
                  })}
                  {parsedActive.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-4">
                      <span className="text-xs font-medium text-gray-500">Total:</span>
                      <span className="text-sm font-bold text-gray-900">{parsedActive.reduce((s, d) => s + d.calories, 0)} kcal</span>
                      <span className="text-xs text-blue-500">P {parsedActive.reduce((s, d) => s + d.protein, 0)}g</span>
                      <span className="text-xs text-amber-500">C {parsedActive.reduce((s, d) => s + d.carbs, 0)}g</span>
                      <span className="text-xs text-rose-500">F {parsedActive.reduce((s, d) => s + d.fat, 0)}g</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── QUICK ADD TAB ── */}
          {tab === "quick" && (
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Food name</label>
                <input
                  type="text"
                  placeholder="e.g. Protein shake"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Calories <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  placeholder="e.g. 300"
                  value={quickCal}
                  onChange={(e) => setQuickCal(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Protein (g)", val: quickProtein, set: setQuickProtein },
                  { label: "Carbs (g)", val: quickCarbs, set: setQuickCarbs },
                  { label: "Fat (g)", val: quickFat, set: setQuickFat },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">{f.label}</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">Macros are optional for a quick calorie entry.</p>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
          {tab === "photo" && photoState === "results" && (
            <button
              onClick={() => logDetections(detections)}
              disabled={activeItems.length === 0}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Log {activeItems.length} item{activeItems.length !== 1 ? "s" : ""} to {slot}
            </button>
          )}
          {tab === "plan" && (
            <p className="text-xs text-center text-gray-400">Select a planned meal above to log it</p>
          )}
          {tab === "recipe" && (
            <button
              disabled={!selectedRecipe}
              onClick={() => {
                if (!selectedRecipe) return;
                onAdd(slot, [{ name: selectedRecipe.name, servings: recipeServings, calories: Math.round(selectedRecipe.calories * recipeServings), protein: Math.round(selectedRecipe.protein * recipeServings), carbs: Math.round(selectedRecipe.carbs * recipeServings), fat: Math.round(selectedRecipe.fat * recipeServings), method: "recipe" }]);
                onClose();
              }}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {selectedRecipe ? `Log ${selectedRecipe.name}` : "Select a recipe"}
            </button>
          )}
          {tab === "search" && (
            <button
              disabled={!selectedUsda}
              onClick={() => {
                if (!selectedUsda) return;
                onAdd(slot, [{ name: selectedUsda.name.split(",")[0], servings: usdaServings, calories: Math.round(selectedUsda.calories * usdaServings), protein: Math.round(selectedUsda.protein * usdaServings), carbs: Math.round(selectedUsda.carbs * usdaServings), fat: Math.round(selectedUsda.fat * usdaServings), method: "search" }]);
                onClose();
              }}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {selectedUsda ? "Log Selected Food" : "Search and select a food"}
            </button>
          )}
          {tab === "text" && parseState !== "results" && (
            <button
              disabled={!parseText.trim() || parseState === "parsing"}
              onClick={handleParse}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Parse with AI
            </button>
          )}
          {tab === "text" && parseState === "results" && (
            <button
              disabled={parsedActive.length === 0}
              onClick={() => logDetections(parsedItems)}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Log {parsedActive.length} item{parsedActive.length !== 1 ? "s" : ""} to {slot}
            </button>
          )}
          {tab === "quick" && (
            <button
              disabled={!quickName.trim() || !quickCal.trim()}
              onClick={() => {
                onAdd(slot, [{ name: quickName, servings: 1, calories: parseInt(quickCal) || 0, protein: parseInt(quickProtein) || 0, carbs: parseInt(quickCarbs) || 0, fat: parseInt(quickFat) || 0, method: "quick" }]);
                onClose();
              }}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add Entry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Journal Page ─────────────────────────────────────────────────────────────

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
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Food Journal</h1>
          <button
            onClick={() => openModal("Breakfast")}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Food
          </button>
        </div>

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
                      <div key={entry.id} className="px-5 py-3 flex items-start gap-3">
                        {entry.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.photoUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{entry.name}</span>
                            {entry.servings !== 1 && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">×{entry.servings}</span>
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
                          <button onClick={() => handleDelete(slot, entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
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
