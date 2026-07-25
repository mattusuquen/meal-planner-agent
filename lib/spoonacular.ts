/**
 * Spoonacular Recipe API client.
 * Docs: https://spoonacular.com/food-api/docs
 */

const BASE_URL = "https://api.spoonacular.com";

function getKey(): string {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) throw new Error("SPOONACULAR_API_KEY is not set");
  return key;
}

// Map our dietary restrictions to Spoonacular's diet param (single value)
function mapDiet(restrictions: string[]): string | undefined {
  const lower = restrictions.map((r) => r.toLowerCase());
  if (lower.some((r) => r.includes("vegan"))) return "vegan";
  if (lower.some((r) => r.includes("vegetarian"))) return "vegetarian";
  if (lower.some((r) => r.includes("keto"))) return "ketogenic";
  if (lower.some((r) => r.includes("paleo"))) return "paleo";
  if (lower.some((r) => r.includes("gluten"))) return "gluten free";
  if (lower.some((r) => r.includes("dairy"))) return "dairy free";
  return undefined;
}

// Map our allergies to Spoonacular's intolerances (comma-separated)
function mapIntolerances(allergies: string[]): string | undefined {
  const supported = [
    "dairy", "egg", "gluten", "grain", "peanut",
    "seafood", "sesame", "shellfish", "soy", "sulfite", "tree nut", "wheat",
  ];
  const matched = allergies
    .map((a) => a.toLowerCase())
    .flatMap((a) => supported.filter((s) => a.includes(s)));
  const unique = [...new Set(matched)];
  return unique.length > 0 ? unique.join(",") : undefined;
}

export interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  servings: number;
  readyInMinutes: number;
  cuisines: string[];
  extendedIngredients: Array<{
    original: string;
    amount: number;
    unit: string;
  }>;
  analyzedInstructions: Array<{
    steps: Array<{ step: string }>;
  }>;
  nutrition: {
    nutrients: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
  };
}

/**
 * Search Spoonacular for recipes matching the given filters, then fetch full
 * details (ingredients, instructions, nutrition) for a randomly chosen result.
 * Randomising the offset on every call ensures variety across generations.
 */
export async function searchAndFetchRecipe(params: {
  query?: string;
  cuisine?: string;
  restrictions?: string[];
  allergies?: string[];
  minCalories?: number;
  maxCalories?: number;
  minProtein?: number;
  maxFat?: number;
}): Promise<SpoonacularRecipe | null> {
  const {
    query,
    cuisine,
    restrictions = [],
    allergies = [],
    minCalories,
    maxCalories,
    minProtein,
    maxFat,
  } = params;
  const key = getKey();

  // Random offset (0–90 in steps of 10) so repeated calls return different recipes
  const offset = Math.floor(Math.random() * 10) * 10;

  const searchParams = new URLSearchParams({
    apiKey: key,
    number: "10",
    offset: String(offset),
    instructionsRequired: "true",
  });

  if (query) searchParams.set("query", query);
  if (cuisine) searchParams.set("cuisine", cuisine);

  const diet = mapDiet(restrictions);
  if (diet) searchParams.set("diet", diet);

  const intolerances = mapIntolerances(allergies);
  if (intolerances) searchParams.set("intolerances", intolerances);

  if (minCalories) searchParams.set("minCalories", String(minCalories));
  if (maxCalories) searchParams.set("maxCalories", String(maxCalories));
  if (minProtein) searchParams.set("minProtein", String(minProtein));
  if (maxFat) searchParams.set("maxFat", String(maxFat));

  const searchRes = await fetch(`${BASE_URL}/recipes/complexSearch?${searchParams}`);
  if (!searchRes.ok) {
    throw new Error(`Spoonacular search failed: ${searchRes.status} ${await searchRes.text()}`);
  }

  const searchData = await searchRes.json();
  const results: Array<{ id: number }> = searchData.results ?? [];

  if (results.length === 0) return null;

  // Pick a random result from the page for additional variety
  const chosen = results[Math.floor(Math.random() * results.length)];

  const detailParams = new URLSearchParams({
    apiKey: key,
    includeNutrition: "true",
  });

  const detailRes = await fetch(
    `${BASE_URL}/recipes/${chosen.id}/information?${detailParams}`
  );
  if (!detailRes.ok) {
    throw new Error(`Spoonacular detail failed: ${detailRes.status}`);
  }

  return detailRes.json() as Promise<SpoonacularRecipe>;
}

/** Extract per-serving macros from Spoonacular recipe data. */
export function extractNutrition(recipe: SpoonacularRecipe): {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
} {
  const get = (name: string) =>
    recipe.nutrition?.nutrients?.find(
      (n) => n.name.toLowerCase() === name.toLowerCase()
    )?.amount ?? 0;

  // Spoonacular returns totals for the whole recipe — divide by servings
  const servings = recipe.servings || 1;

  return {
    calories: Math.round(get("Calories") / servings),
    protein_g: Math.round((get("Protein") / servings) * 10) / 10,
    carbs_g: Math.round((get("Carbohydrates") / servings) * 10) / 10,
    fat_g: Math.round((get("Fat") / servings) * 10) / 10,
  };
}
