import type { SupabaseClient } from "@supabase/supabase-js";
import type { NutritionPer100g, NutritionCache, USDASearchResult } from "./types";

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";

// USDA nutrient IDs
const NUTRIENT_CALORIES = 1008;
const NUTRIENT_PROTEIN = 1003;
const NUTRIENT_CARBS = 1005;
const NUTRIENT_FAT = 1004;

interface USDAFoodNutrient {
  nutrientId: number;
  value: number;
}

interface USDAFood {
  fdcId: number;
  description: string;
  foodNutrients: USDAFoodNutrient[];
}

export function extractPer100g(food: USDAFood): NutritionPer100g {
  const get = (id: number) =>
    food.foodNutrients?.find((n) => n.nutrientId === id)?.value ?? 0;
  return {
    calories: get(NUTRIENT_CALORIES),
    protein_g: get(NUTRIENT_PROTEIN),
    carbs_g: get(NUTRIENT_CARBS),
    fat_g: get(NUTRIENT_FAT),
  };
}

export async function searchUSDA(
  query: string,
  limit = 8
): Promise<USDASearchResult[]> {
  const apiKey = process.env.USDA_API_KEY;
  const url = `${USDA_BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=${limit}&api_key=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return [];

  const json = await res.json();
  const foods: USDAFood[] = json.foods ?? [];

  return foods.map((food) => {
    const per_100g = extractPer100g(food);
    return {
      fdcId: food.fdcId,
      description: food.description,
      calories: per_100g.calories,
      protein_g: per_100g.protein_g,
      carbs_g: per_100g.carbs_g,
      fat_g: per_100g.fat_g,
      per_100g,
    };
  });
}

export async function matchIngredient(
  rawText: string,
  supabase: SupabaseClient
): Promise<{
  fdcId: number;
  description: string;
  per_100g: NutritionPer100g;
} | null> {
  const results = await searchUSDA(rawText, 3);
  if (!results.length) return null;

  const best = results[0];

  // Cache the result
  await cacheUSDAResult(best.fdcId, best.description, best.per_100g, supabase);

  return {
    fdcId: best.fdcId,
    description: best.description,
    per_100g: best.per_100g,
  };
}

export async function cacheUSDAResult(
  fdcId: number,
  description: string,
  per100g: NutritionPer100g,
  supabase: SupabaseClient
): Promise<void> {
  await supabase.from("nutrition_cache").upsert(
    {
      usda_fdc_id: fdcId,
      description,
      per_100g: per100g,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "usda_fdc_id" }
  );
}

export async function getOrFetchAndCache(
  fdcId: number,
  supabase: SupabaseClient
): Promise<NutritionCache | null> {
  // Check cache first
  const { data } = await supabase
    .from("nutrition_cache")
    .select("*")
    .eq("usda_fdc_id", fdcId)
    .single();

  if (data) return data as NutritionCache;

  // Fetch from USDA
  const apiKey = process.env.USDA_API_KEY;
  const url = `${USDA_BASE}/food/${fdcId}?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const food: USDAFood = await res.json();
  const per_100g = extractPer100g(food);

  await cacheUSDAResult(fdcId, food.description, per_100g, supabase);

  return {
    usda_fdc_id: fdcId,
    description: food.description,
    per_100g,
    fetched_at: new Date().toISOString(),
  };
}
