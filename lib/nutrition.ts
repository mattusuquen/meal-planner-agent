import type { NutritionPer100g, DailyTotals } from "./types";

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calcTDEE(params: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: "male" | "female";
  activityLevel: string;
}): number {
  const { weightKg, heightCm, ageYears, sex, activityLevel } = params;
  const bmr =
    sex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  return Math.round(bmr * multiplier);
}

export function calcMacroTargets(
  tdee: number,
  goal: string,
  ratePerWeek: number
): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
  let calories = tdee;
  if (goal === "lose") calories -= ratePerWeek * 500;
  if (goal === "gain") calories += ratePerWeek * 250;
  calories = Math.max(1200, Math.round(calories));

  // 30% protein, 45% carbs, 25% fat
  const protein_g = Math.round((calories * 0.3) / 4);
  const carbs_g = Math.round((calories * 0.45) / 4);
  const fat_g = Math.round((calories * 0.25) / 9);

  return { calories, protein_g, carbs_g, fat_g };
}

export function calcNutrientsFromUSDA(
  per100g: NutritionPer100g,
  grams: number
): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
  const ratio = grams / 100;
  return {
    calories: Math.round(per100g.calories * ratio),
    protein_g: Math.round(per100g.protein_g * ratio * 10) / 10,
    carbs_g: Math.round(per100g.carbs_g * ratio * 10) / 10,
    fat_g: Math.round(per100g.fat_g * ratio * 10) / 10,
  };
}

export function sumIngredientMacros(
  ingredients: Array<{ per_100g: NutritionPer100g; grams: number }>
): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
  return ingredients.reduce(
    (acc, ing) => {
      const n = calcNutrientsFromUSDA(ing.per_100g, ing.grams);
      return {
        calories: acc.calories + n.calories,
        protein_g: acc.protein_g + n.protein_g,
        carbs_g: acc.carbs_g + n.carbs_g,
        fat_g: acc.fat_g + n.fat_g,
      };
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recalcDailyTotals(supabase: any, userId: string, date: string): Promise<DailyTotals> {
  // Fetch all logged meals for this user+date
  const { data: meals, error } = await supabase
    .from("logged_meals")
    .select("servings, custom_entry, recipe_id, recipes(calories, protein_g, carbs_g, fat_g)")
    .eq("user_id", userId)
    .eq("logged_date", date);

  if (error) throw error;

  let calories = 0;
  let protein_g = 0;
  let carbs_g = 0;
  let fat_g = 0;

  for (const meal of meals ?? []) {
    const servings = meal.servings ?? 1;
    if (meal.recipe_id && meal.recipes) {
      calories += meal.recipes.calories * servings;
      protein_g += meal.recipes.protein_g * servings;
      carbs_g += meal.recipes.carbs_g * servings;
      fat_g += meal.recipes.fat_g * servings;
    } else if (meal.custom_entry) {
      calories += (meal.custom_entry.calories ?? 0) * servings;
      protein_g += (meal.custom_entry.protein_g ?? 0) * servings;
      carbs_g += (meal.custom_entry.carbs_g ?? 0) * servings;
      fat_g += (meal.custom_entry.fat_g ?? 0) * servings;
    }
  }

  const totals: DailyTotals = {
    user_id: userId,
    date,
    calories: Math.round(calories),
    protein_g: Math.round(protein_g * 10) / 10,
    carbs_g: Math.round(carbs_g * 10) / 10,
    fat_g: Math.round(fat_g * 10) / 10,
    meals_logged: meals?.length ?? 0,
  };

  await supabase.from("daily_totals").upsert(totals, { onConflict: "user_id,date" });

  return totals;
}
