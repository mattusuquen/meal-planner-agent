import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ recipes: recipes ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    ingredients = [],
    instructions = [],
    servings = 1,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      created_by: user.id,
      name,
      instructions,
      servings,
      source: "ai",
      calories: Math.round(calories ?? 0),
      protein_g: Math.round((protein_g ?? 0) * 10) / 10,
      carbs_g: Math.round((carbs_g ?? 0) * 10) / 10,
      fat_g: Math.round((fat_g ?? 0) * 10) / 10,
    })
    .select()
    .single();

  if (error || !recipe) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to save recipe" },
      { status: 500 }
    );
  }

  if (ingredients.length > 0) {
    await supabase.from("recipe_ingredients").insert(
      (ingredients as string[]).map((raw_text) => ({
        recipe_id: recipe.id,
        usda_fdc_id: null,
        raw_text,
        quantity: 0,
        unit: "",
        grams: 0,
      }))
    );
  }

  return NextResponse.json({ recipe });
}
