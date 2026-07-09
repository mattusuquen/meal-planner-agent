import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { recipeGraph } from "@/lib/langchain/graphs/recipeGraph";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { prompt, cuisine, restrictions = [], allergies = [] } = body;

  // Ensure profile row exists (handles signup before migration trigger)
  await supabase
    .from("profiles")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  // Fetch user profile for context
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "calorie_target, protein_g, carbs_g, fat_g, dietary_restrictions, allergies, cuisines"
    )
    .eq("id", user.id)
    .single();

  const allRestrictions = [
    ...(profile?.dietary_restrictions ?? []),
    ...restrictions,
  ];
  const allAllergies = [...(profile?.allergies ?? []), ...allergies];

  const result = await recipeGraph.invoke({
    supabase,
    userId: user.id,
    prompt,
    cuisine,
    restrictions: allRestrictions,
    allergies: allAllergies,
    profile,
  });

  if (result.error || !result.savedRecipe) {
    console.error(
      "[POST /api/recipes/generate] graph error:",
      result.error ?? "no recipe saved"
    );
    return NextResponse.json(
      { error: result.error ?? "Failed to generate recipe" },
      { status: 500 }
    );
  }

  return NextResponse.json({ recipe: result.savedRecipe });
}
