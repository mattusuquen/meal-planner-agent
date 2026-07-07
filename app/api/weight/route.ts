import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "90"), 365);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: entries } = await supabase
    .from("weight_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: true })
    .limit(limit);

  return NextResponse.json({ entries: entries ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entry_date, weight_lbs, weight_kg: weightKgInput } = await request.json();

  if (!entry_date || (!weight_lbs && !weightKgInput)) {
    return NextResponse.json({ error: "entry_date and weight are required" }, { status: 400 });
  }

  // Ensure profile row exists (handles signup before migration trigger)
  await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  const weight_kg = weightKgInput ?? weight_lbs * 0.453592;

  const { data: entry, error } = await supabase
    .from("weight_entries")
    .upsert(
      { user_id: user.id, entry_date, weight_kg: Math.round(weight_kg * 100) / 100 },
      { onConflict: "user_id,entry_date" }
    )
    .select()
    .single();

  if (error) {
    console.error("[POST /api/weight] upsert error:", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry });
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

  const { error } = await supabase
    .from("weight_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
