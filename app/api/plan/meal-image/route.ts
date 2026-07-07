import { createClient } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { openai } from "@/lib/openai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan_id, day, slot } = await request.json();

  if (!plan_id || !day || !slot) {
    return NextResponse.json({ error: "plan_id, day, and slot are required" }, { status: 400 });
  }

  // Fetch the plan to get meal name
  const { data: planRow } = await adminSupabase
    .from("meal_plans")
    .select("plan")
    .eq("id", plan_id)
    .single();

  if (!planRow) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const meal = planRow.plan[day]?.[slot];
  if (!meal) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  // Return existing image if already cached in DB
  if (meal.image_url) {
    return NextResponse.json({ image_url: meal.image_url });
  }

  try {
    const prompt = `Professional food photography of ${meal.name}, beautifully plated on a clean white ceramic plate, soft natural lighting, overhead angle, high resolution, restaurant quality food photo`;

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "low",
    });

    const imageData = response.data?.[0];
    if (!imageData || !imageData.b64_json) {
      return NextResponse.json({ error: "No image data returned" }, { status: 500 });
    }

    const buffer = Buffer.from(imageData.b64_json, "base64");
    const fileName = `plan-${plan_id}-${day}-${slot.toLowerCase()}.png`;

    // Try to upload to Supabase Storage
    const { error: uploadError } = await adminSupabase.storage
      .from("recipe-images")
      .upload(fileName, buffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("[meal-image] Supabase upload error:", uploadError.message);
      // Fall back to base64 data URI so the image still shows in the current session
      return NextResponse.json({
        image_url: `data:image/png;base64,${imageData.b64_json}`,
      });
    }

    const { data: urlData } = adminSupabase.storage
      .from("recipe-images")
      .getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // Persist image_url back into the plan JSONB so future page loads skip regeneration
    const updatedPlan = structuredClone(planRow.plan);
    if (updatedPlan[day]?.[slot]) {
      updatedPlan[day][slot] = { ...updatedPlan[day][slot], image_url: imageUrl };
      const { error: updateError } = await adminSupabase
        .from("meal_plans")
        .update({ plan: updatedPlan })
        .eq("id", plan_id);
      if (updateError) {
        console.error("[meal-image] JSONB update error:", updateError.message);
      }
    }

    return NextResponse.json({ image_url: imageUrl });
  } catch (err) {
    console.error("[POST /api/plan/meal-image] error:", err);
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
