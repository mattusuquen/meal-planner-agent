import { createClient } from "@/lib/supabase/server";
import { openai } from "@/lib/openai";
import { matchIngredient } from "@/lib/usda";
import { calcNutrientsFromUSDA } from "@/lib/nutrition";
import { NextResponse } from "next/server";
import { z } from "zod";

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

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { prompt, cuisine, restrictions = [], allergies = [] } = body;

  // Ensure profile row exists (handles signup before migration trigger)
  await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  // Fetch user profile for context
  const { data: profile } = await supabase
    .from("profiles")
    .select("calorie_target, protein_g, carbs_g, fat_g, dietary_restrictions, allergies, cuisines")
    .eq("id", user.id)
    .single();

  const allRestrictions = [...(profile?.dietary_restrictions ?? []), ...restrictions];
  const allAllergies = [...(profile?.allergies ?? []), ...allergies];

  const systemPrompt = `You are a professional chef and nutritionist. Generate a healthy, delicious recipe.
${allRestrictions.length ? `Dietary restrictions: ${allRestrictions.join(", ")}` : ""}
${allAllergies.length ? `AVOID these allergens: ${allAllergies.join(", ")}` : ""}
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

  const userMessage = prompt ?? `Generate a healthy ${cuisine ?? "balanced"} recipe${allRestrictions.length ? ` that is ${allRestrictions.join(" and ")}` : ""}.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  let parsed;
  try {
    parsed = RecipeSchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Failed to parse AI recipe output" }, { status: 500 });
  }

  // Match each ingredient to USDA and calculate macros
  const ingredientData: {
    raw_text: string;
    quantity: number;
    unit: string;
    grams: number;
    usda_fdc_id: number | null;
    macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  }[] = [];

  for (const ing of parsed.ingredients) {
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

  const totals = ingredientData.reduce(
    (acc, i) => ({
      calories: acc.calories + i.macros.calories,
      protein_g: acc.protein_g + i.macros.protein_g,
      carbs_g: acc.carbs_g + i.macros.carbs_g,
      fat_g: acc.fat_g + i.macros.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  // Save recipe
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      created_by: user.id,
      name: parsed.name,
      instructions: parsed.instructions,
      servings: parsed.servings,
      source: "ai",
      cuisine: parsed.cuisine,
      prep_minutes: parsed.prep_minutes,
      calories: Math.round(totals.calories / parsed.servings),
      protein_g: Math.round(totals.protein_g / parsed.servings * 10) / 10,
      carbs_g: Math.round(totals.carbs_g / parsed.servings * 10) / 10,
      fat_g: Math.round(totals.fat_g / parsed.servings * 10) / 10,
    })
    .select()
    .single();

  if (recipeError || !recipe) {
    console.error("[POST /api/recipes/generate] save error:", recipeError?.message, recipeError?.details);
    return NextResponse.json({ error: recipeError?.message ?? "Failed to save recipe" }, { status: 500 });
  }

  // Save ingredients
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

  // Fire-and-forget image generation
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  fetch(`${baseUrl}/api/recipes/${recipe.id}/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).catch(() => { });

  return NextResponse.json({ recipe });
}
