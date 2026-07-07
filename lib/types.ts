export interface Profile {
  id: string;
  goal: "lose" | "maintain" | "gain" | null;
  activity_level: string | null;
  height_cm: number | null;
  birth_date: string | null;
  sex: "male" | "female" | null;
  calorie_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  dietary_restrictions: string[];
  allergies: string[];
  dislikes: string[];
  cuisines: string[];
  meal_structure: string;
  display_name: string | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface NutritionPer100g {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface NutritionCache {
  usda_fdc_id: number;
  description: string;
  per_100g: NutritionPer100g;
  fetched_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  usda_fdc_id: number | null;
  raw_text: string;
  quantity: number;
  unit: string;
  grams: number;
  // joined
  nutrition_cache?: NutritionCache;
}

export interface Recipe {
  id: string;
  created_by: string;
  name: string;
  instructions: string[];
  servings: number;
  image_url: string | null;
  source: "ai" | "user";
  cuisine: string | null;
  prep_minutes: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
  recipe_ingredients?: RecipeIngredient[];
}

export interface MealCell {
  recipe_id?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients?: string[];
  description?: string;
  image_url?: string;
}

export type MealPlanData = Record<string, Record<string, MealCell | null>>;

export interface MealPlan {
  id: string;
  user_id: string;
  week_start: string;
  plan: MealPlanData;
  status: string;
  created_at: string;
}

export interface CustomEntry {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface LoggedMeal {
  id: string;
  user_id: string;
  logged_date: string;
  recipe_id: string | null;
  custom_entry: CustomEntry | null;
  servings: number;
  meal_slot: string;
  entry_method: string;
  photo_url: string | null;
  created_at: string;
  // joined
  recipe?: Recipe;
}

export interface DailyTotals {
  user_id: string;
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals_logged: number;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  entry_date: string;
  weight_kg: number;
  created_at: string;
}

export interface USDASearchResult {
  fdcId: number;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  per_100g: NutritionPer100g;
}
