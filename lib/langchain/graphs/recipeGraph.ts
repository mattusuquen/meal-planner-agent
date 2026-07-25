/**
 * LangGraph pipeline for recipe fetching via Spoonacular API.
 *
 * Nodes: fetchSpoonacularRecipe → saveRecipe
 * Replaces the previous AI-generation + DALL-E image pipeline with real
 * recipe data and real photos from Spoonacular.
 */
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Recipe } from "@/lib/types";
import { searchAndFetchRecipe, extractNutrition } from "@/lib/spoonacular";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const RecipeState = Annotation.Root({
  // ── Inputs ──
  supabase: Annotation<SupabaseClient>(),
  userId: Annotation<string>(),
  prompt: Annotation<string | undefined>(),
  cuisine: Annotation<string | undefined>(),
  restrictions: Annotation<string[]>(),
  allergies: Annotation<string[]>(),
  profile: Annotation<Partial<Profile> | null>(),

  // ── Pipeline state ──
  savedRecipe: Annotation<Recipe | null>({
    value: (_, update) => update,
    default: () => null,
  }),
  error: Annotation<string | null>({
    value: (_, update) => update,
    default: () => null,
  }),
});

type RecipeStateType = typeof RecipeState.State;

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

async function fetchSpoonacularRecipe(
  state: RecipeStateType
): Promise<Partial<RecipeStateType>> {
  const { supabase, userId, prompt, cuisine, restrictions, allergies, profile } = state;

  // Per-meal targets — assume 3 meals per day
  const mealsPerDay = 3;
  const calTarget = profile?.calorie_target ?? null;
  const proteinTarget = profile?.protein_g ?? null;
  const fatTarget = profile?.fat_g ?? null;

  // Allow ±25% around the per-meal calorie target so results aren't too narrow
  const perMealCal = calTarget ? calTarget / mealsPerDay : null;
  const minCalories = perMealCal ? Math.round(perMealCal * 0.75) : undefined;
  const maxCalories = perMealCal ? Math.round(perMealCal * 1.25) : undefined;

  // Minimum protein per meal (50% of daily target / 3 meals — a soft lower bound)
  const minProtein = proteinTarget ? Math.round((proteinTarget / mealsPerDay) * 0.5) : undefined;

  // Max fat per meal (daily target / 3 meals with 25% buffer)
  const maxFat = fatTarget ? Math.round((fatTarget / mealsPerDay) * 1.25) : undefined;

  // If no cuisine specified, pick randomly from the user's preferred cuisines
  const effectiveCuisine =
    cuisine ||
    (profile?.cuisines?.length
      ? profile.cuisines[Math.floor(Math.random() * profile.cuisines.length)]
      : undefined);

  const spoon = await searchAndFetchRecipe({
    query: prompt,
    cuisine: effectiveCuisine,
    restrictions,
    allergies,
    minCalories,
    maxCalories,
    minProtein,
    maxFat,
  });

  if (!spoon) {
    return { error: "No matching recipes found. Try different filters." };
  }

  const nutrition = extractNutrition(spoon);
  const servings = spoon.servings || 1;

  const instructions = spoon.analyzedInstructions
    .flatMap((block) => block.steps.map((s) => s.step))
    .filter(Boolean);

  const ingredients = spoon.extendedIngredients.map((ing) => ({
    raw_text: ing.original,
    quantity: ing.amount,
    unit: ing.unit,
    grams: 0,
    usda_fdc_id: null,
  }));

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      created_by: userId,
      name: spoon.title,
      instructions,
      servings,
      image_url: spoon.image || null,
      source: "spoonacular",
      cuisine: spoon.cuisines?.[0] ?? cuisine ?? null,
      prep_minutes: spoon.readyInMinutes ?? null,
      calories: nutrition.calories,
      protein_g: nutrition.protein_g,
      carbs_g: nutrition.carbs_g,
      fat_g: nutrition.fat_g,
    })
    .select()
    .single();

  if (recipeError || !recipe) {
    console.error("[recipeGraph/fetchSpoonacularRecipe]", recipeError?.message);
    return { error: recipeError?.message ?? "Failed to save recipe" };
  }

  if (ingredients.length > 0) {
    await supabase.from("recipe_ingredients").insert(
      ingredients.map((i) => ({
        recipe_id: recipe.id,
        usda_fdc_id: i.usda_fdc_id,
        raw_text: i.raw_text,
        quantity: i.quantity,
        unit: i.unit,
        grams: i.grams,
      }))
    );
  }

  return { savedRecipe: recipe as Recipe };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

function routeAfterFetch(
  state: RecipeStateType
): typeof END {
  return END;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export const recipeGraph = new StateGraph(RecipeState)
  .addNode("fetchSpoonacularRecipe", fetchSpoonacularRecipe)
  .addEdge(START, "fetchSpoonacularRecipe")
  .addConditionalEdges("fetchSpoonacularRecipe", routeAfterFetch)
  .compile();
