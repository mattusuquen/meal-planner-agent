import { createClient } from "@/lib/supabase/server";
import { openai } from "@/lib/openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const MealCellSchema = z.object({
  name: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

const PlanSchema = z.record(
  z.string(),
  z.object({
    Breakfast: MealCellSchema.nullable(),
    Lunch: MealCellSchema.nullable(),
    Dinner: MealCellSchema.nullable(),
    Snacks: MealCellSchema.nullable(),
  })
);

function getWeekDays(weekStart: string): string[] {
  // Parse as local noon to avoid UTC midnight offset issues across timezones
  const start = new Date(weekStart + "T12:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { week_start } = body;

  if (!week_start) {
    return NextResponse.json({ error: "week_start is required" }, { status: 400 });
  }

  // Ensure profile row exists (handles signup before migration trigger)
  await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const days = getWeekDays(week_start);
  const slots = profile?.meal_structure === "3_meals"
    ? ["Breakfast", "Lunch", "Dinner"]
    : ["Breakfast", "Lunch", "Dinner", "Snacks"];

  const systemPrompt = `You are a professional nutritionist creating a weekly meal plan.
Target macros per day:
- Calories: ~${profile?.calorie_target ?? 2000} kcal
- Protein: ~${profile?.protein_g ?? 150}g
- Carbs: ~${profile?.carbs_g ?? 200}g
- Fat: ~${profile?.fat_g ?? 65}g

${profile?.dietary_restrictions?.length ? `Dietary restrictions: ${profile.dietary_restrictions.join(", ")}` : ""}
${profile?.allergies?.length ? `AVOID allergens: ${profile.allergies.join(", ")}` : ""}
${profile?.cuisines?.length ? `Preferred cuisines: ${profile.cuisines.join(", ")}` : ""}

Meal slots per day: ${slots.join(", ")}

Return ONLY a JSON object with this structure:
{
  "${days[0]}": { "Breakfast": { "name": string, "calories": number, "protein": number, "carbs": number, "fat": number } | null, "Lunch": {...} | null, "Dinner": {...} | null, "Snacks": {...} | null },
  "${days[1]}": { ... },
  ... (all 7 days: ${days.join(", ")})
}

Each meal should have accurate estimated macros. Keep meals varied and interesting.`;

  let attempts = 0;
  let planData = null;

  while (attempts < 2) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create a 7-day meal plan for the week starting ${week_start}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    try {
      const parsed = PlanSchema.parse(JSON.parse(raw));
      planData = parsed;
      break;
    } catch {
      attempts++;
    }
  }

  if (!planData) {
    return NextResponse.json({ error: "Failed to generate meal plan" }, { status: 500 });
  }

  // Archive any existing active plan for this week
  await supabase
    .from("meal_plans")
    .update({ status: "archived" })
    .eq("user_id", user.id)
    .eq("week_start", week_start)
    .eq("status", "active");

  // Save new plan
  const { data: plan, error } = await supabase
    .from("meal_plans")
    .insert({
      user_id: user.id,
      week_start,
      plan: planData,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/plan/generate] save error:", error.message, error.details);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plan });
}
