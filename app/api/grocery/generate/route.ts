import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const CATEGORIES: Record<string, { name: string; icon: string; keywords: string[] }> = {
  produce: { name: "Produce", icon: "🥦", keywords: ["spinach", "lettuce", "tomato", "broccoli", "carrot", "onion", "garlic", "pepper", "cucumber", "kale", "apple", "banana", "lemon", "lime", "avocado", "vegetable", "fruit", "herb", "basil", "cilantro", "parsley"] },
  proteins: { name: "Proteins", icon: "🥩", keywords: ["chicken", "beef", "pork", "turkey", "salmon", "tuna", "shrimp", "tofu", "tempeh", "egg", "fish", "steak", "ground", "meat", "seafood"] },
  dairy: { name: "Dairy", icon: "🧀", keywords: ["milk", "cheese", "yogurt", "butter", "cream", "mozzarella", "parmesan", "cheddar", "feta", "dairy"] },
  pantry: { name: "Pantry", icon: "🫙", keywords: ["oil", "vinegar", "sauce", "paste", "can", "broth", "stock", "salt", "pepper", "spice", "sugar", "honey", "flour", "corn starch", "soy sauce", "mustard", "mayo"] },
  grains: { name: "Grains", icon: "🌾", keywords: ["rice", "pasta", "bread", "quinoa", "oat", "tortilla", "noodle", "grain", "wheat", "couscous", "barley"] },
};

function categorize(ingredient: string): string {
  const lower = ingredient.toLowerCase();
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (cat.keywords.some((k) => lower.includes(k))) {
      return key;
    }
  }
  return "other";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { week_start } = body;

  // Get active meal plan for the week
  let planQuery = supabase
    .from("meal_plans")
    .select("plan")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (week_start) {
    planQuery = planQuery.eq("week_start", week_start);
  }

  const { data: mealPlan } = await planQuery.order("created_at", { ascending: false }).maybeSingle();

  if (!mealPlan) {
    return NextResponse.json({ categories: [] });
  }

  // Collect all recipe IDs from the plan
  const recipeIds: string[] = [];
  for (const day of Object.values(mealPlan.plan as Record<string, Record<string, { recipe_id?: string } | null>>)) {
    for (const meal of Object.values(day)) {
      if (meal?.recipe_id) recipeIds.push(meal.recipe_id);
    }
  }

  // Fetch recipe ingredients for matched recipes
  const ingredientMap = new Map<string, { name: string; totalGrams: number; unit: string }>();

  if (recipeIds.length > 0) {
    const { data: ingredients } = await supabase
      .from("recipe_ingredients")
      .select("raw_text, quantity, unit, grams")
      .in("recipe_id", recipeIds);

    for (const ing of ingredients ?? []) {
      const key = ing.raw_text.toLowerCase().trim();
      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key)!;
        existing.totalGrams += ing.grams ?? 0;
      } else {
        ingredientMap.set(key, {
          name: ing.raw_text,
          totalGrams: ing.grams ?? 0,
          unit: ing.unit ?? "g",
        });
      }
    }
  }

  // Also collect meal names from the plan for meals without recipe_id
  const mealNames: string[] = [];
  for (const day of Object.values(mealPlan.plan as Record<string, Record<string, { name?: string; recipe_id?: string } | null>>)) {
    for (const meal of Object.values(day)) {
      if (meal && !meal.recipe_id && meal.name) {
        mealNames.push(meal.name);
      }
    }
  }

  // Build categories
  const categoryMap: Record<string, { name: string; icon: string; items: { id: string; name: string; amount: string }[] }> = {};

  let itemIdx = 0;
  for (const [rawName, data] of ingredientMap) {
    const catKey = categorize(rawName);
    if (!categoryMap[catKey]) {
      const cat = CATEGORIES[catKey] ?? { name: "Other", icon: "🛒" };
      categoryMap[catKey] = { name: cat.name, icon: cat.icon, items: [] };
    }
    const amount = data.totalGrams > 0
      ? `${Math.round(data.totalGrams)}g`
      : `${data.name}`;
    categoryMap[catKey].items.push({
      id: `item-${itemIdx++}`,
      name: data.name,
      amount,
    });
  }

  // Ensure all categories exist even if empty
  const orderedCategories = ["produce", "proteins", "dairy", "pantry", "grains", "other"]
    .filter((k) => categoryMap[k])
    .map((k) => categoryMap[k]);

  return NextResponse.json({ categories: orderedCategories, meal_names: mealNames });
}
