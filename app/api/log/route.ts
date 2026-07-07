import { createClient } from "@/lib/supabase/server";
import { recalcDailyTotals } from "@/lib/nutrition";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const { data: meals, error } = await supabase
    .from("logged_meals")
    .select("*, recipe:recipes(id, name, calories, protein_g, carbs_g, fat_g, image_url)")
    .eq("user_id", user.id)
    .eq("logged_date", date)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ meals: meals ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    logged_date,
    meal_slot,
    entry_method,
    servings = 1,
    recipe_id,
    custom_entry,
    photo_url,
  } = body;

  if (!logged_date || !meal_slot || !entry_method) {
    return NextResponse.json({ error: "logged_date, meal_slot, and entry_method are required" }, { status: 400 });
  }

  // Ensure profile row exists (handles signup before migration trigger)
  await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  const { data: meal, error } = await supabase
    .from("logged_meals")
    .insert({
      user_id: user.id,
      logged_date,
      meal_slot,
      entry_method,
      servings,
      recipe_id: recipe_id ?? null,
      custom_entry: custom_entry ?? null,
      photo_url: photo_url ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/log] insert error:", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let daily_totals;
  try {
    daily_totals = await recalcDailyTotals(supabase, user.id, logged_date);
  } catch (e) {
    console.error("[POST /api/log] recalcDailyTotals error:", e);
  }

  return NextResponse.json({ meal, daily_totals: daily_totals ?? null });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Get the date before deleting so we can recalculate
  const { data: existing } = await supabase
    .from("logged_meals")
    .select("logged_date")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Log entry not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("logged_meals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const daily_totals = await recalcDailyTotals(supabase, user.id, existing.logged_date);

  return NextResponse.json({ success: true, daily_totals });
}
