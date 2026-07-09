/**
 * LangGraph pipeline for recipe generation (Design Doc §12, Item 2).
 *
 * Nodes: generateRecipe → lookupNutrition → calculateMacros → saveRecipe → generateImage
 * Conditional edges: skip subsequent nodes on error; skip image if already cached.
 */
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Recipe } from "@/lib/types";
import { matchIngredient } from "@/lib/usda";
import { calcNutrientsFromUSDA } from "@/lib/nutrition";

// ---------------------------------------------------------------------------
// Zod schema (identical to the one previously in the route handler)
// ---------------------------------------------------------------------------

const RecipeSchema = z.object({
  name: z.string(),
  servings: z.number().int().min(1),
  prep_minutes: z.number().int().min(0),
  cuisine: z.string(),
  instructions: z.array(z.string()),
  ingredients: z.array(
    z.object({
      raw_text: z.string(),
      quantity: z.number(),
      unit: z.string(),
      estimated_grams: z.number(),
    })
  ),
});

type ParsedRecipe = z.infer<typeof RecipeSchema>;

type MacroTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type EnrichedIngredient = {
  raw_text: string;
  quantity: number;
  unit: string;
  grams: number;
  usda_fdc_id: number | null;
  macros: MacroTotals;
};

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
  parsedRecipe: Annotation<ParsedRecipe | null>({
    value: (_, update) => update,
    default: () => null,
  }),
  ingredientData: Annotation<EnrichedIngredient[]>({
    value: (_, update) => update,
    default: () => [],
  }),
  macroTotals: Annotation<MacroTotals | null>({
    value: (_, update) => update,
    default: () => null,
  }),
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

async function generateRecipe(
  state: RecipeStateType
): Promise<Partial<RecipeStateType>> {
  const { profile, cuisine, restrictions, allergies, prompt } = state;

  const systemPrompt = `You are a professional chef and nutritionist. Generate a healthy, delicious recipe.
${restrictions.length ? `Dietary restrictions: ${restrictions.join(", ")}` : ""}
${allergies.length ? `AVOID these allergens: ${allergies.join(", ")}` : ""}
${cuisine ? `Cuisine style: ${cuisine}` : ""}
${profile?.calorie_target ? `Target approximately ${Math.round(profile.calorie_target / 3)} calories per serving.` : ""}

Return ONLY a JSON object matching this exact schema:
{
  "name": string,
  "servings": number (integer),
  "prep_minutes": number,
  "cuisine": string,
  "instructions": string[],
  "ingredients": [{ "raw_text": string, "quantity": number, "unit": string, "estimated_grams": number }]
}`;

  const userMessage =
    prompt ??
    `Generate a healthy ${cuisine ?? "balanced"} recipe${restrictions.length ? ` that is ${restrictions.join(" and ")}` : ""}.`;

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.8,
    modelKwargs: { response_format: { type: "json_object" } },
  });

  const response = await model.invoke([
    ["system", systemPrompt],
    ["human", userMessage],
  ]);

  const raw =
    typeof response.content === "string" ? response.content : "{}";

  const result = RecipeSchema.safeParse(JSON.parse(raw));
  if (!result.success) {
    const msg = result.error.issues.map((i) => i.message).join("; ");
    console.error("[recipeGraph/generateRecipe] parse error:", msg);
    return { error: "Failed to parse AI recipe output" };
  }

  return { parsedRecipe: result.data };
}

async function lookupNutrition(
  state: RecipeStateType
): Promise<Partial<RecipeStateType>> {
  const { supabase, parsedRecipe } = state;
  if (!parsedRecipe) return {};

  const ingredientData: EnrichedIngredient[] = [];

  for (const ing of parsedRecipe.ingredients) {
    const match = await matchIngredient(ing.raw_text, supabase);
    const macros = match
      ? calcNutrientsFromUSDA(match.per_100g, ing.estimated_grams)
      : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

    ingredientData.push({
      raw_text: ing.raw_text,
      quantity: ing.quantity,
      unit: ing.unit,
      grams: ing.estimated_grams,
      usda_fdc_id: match?.fdcId ?? null,
      macros,
    });
  }

  return { ingredientData };
}

async function calculateMacros(
  state: RecipeStateType
): Promise<Partial<RecipeStateType>> {
  const totals = state.ingredientData.reduce<MacroTotals>(
    (acc, ing) => ({
      calories: acc.calories + ing.macros.calories,
      protein_g: acc.protein_g + ing.macros.protein_g,
      carbs_g: acc.carbs_g + ing.macros.carbs_g,
      fat_g: acc.fat_g + ing.macros.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
  return { macroTotals: totals };
}

async function saveRecipe(
  state: RecipeStateType
): Promise<Partial<RecipeStateType>> {
  const { supabase, userId, parsedRecipe, ingredientData, macroTotals } =
    state;
  if (!parsedRecipe || !macroTotals) return { error: "Missing recipe data" };

  const servings = parsedRecipe.servings;

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      created_by: userId,
      name: parsedRecipe.name,
      instructions: parsedRecipe.instructions,
      servings,
      source: "ai",
      cuisine: parsedRecipe.cuisine,
      prep_minutes: parsedRecipe.prep_minutes,
      calories: Math.round(macroTotals.calories / servings),
      protein_g: Math.round((macroTotals.protein_g / servings) * 10) / 10,
      carbs_g: Math.round((macroTotals.carbs_g / servings) * 10) / 10,
      fat_g: Math.round((macroTotals.fat_g / servings) * 10) / 10,
    })
    .select()
    .single();

  if (recipeError || !recipe) {
    console.error(
      "[recipeGraph/saveRecipe]",
      recipeError?.message,
      recipeError?.details
    );
    return { error: recipeError?.message ?? "Failed to save recipe" };
  }

  if (ingredientData.length > 0) {
    await supabase.from("recipe_ingredients").insert(
      ingredientData.map((i) => ({
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

async function generateImage(
  state: RecipeStateType
): Promise<Partial<RecipeStateType>> {
  if (!state.savedRecipe) return {};

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Fire-and-forget — do NOT await
  fetch(`${baseUrl}/api/recipes/${state.savedRecipe.id}/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).catch(() => {});

  return {};
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

function routeAfterGenerate(
  state: RecipeStateType
): "lookupNutrition" | typeof END {
  return state.parsedRecipe !== null ? "lookupNutrition" : END;
}

function routeAfterSave(
  state: RecipeStateType
): "generateImage" | typeof END {
  return state.savedRecipe !== null ? "generateImage" : END;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export const recipeGraph = new StateGraph(RecipeState)
  .addNode("generateRecipe", generateRecipe)
  .addNode("lookupNutrition", lookupNutrition)
  .addNode("calculateMacros", calculateMacros)
  .addNode("saveRecipe", saveRecipe)
  .addNode("generateImage", generateImage)
  .addEdge(START, "generateRecipe")
  .addConditionalEdges("generateRecipe", routeAfterGenerate)
  .addEdge("lookupNutrition", "calculateMacros")
  .addEdge("calculateMacros", "saveRecipe")
  .addConditionalEdges("saveRecipe", routeAfterSave)
  .addEdge("generateImage", END)
  .compile();
