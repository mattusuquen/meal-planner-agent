import { createClient } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { openai } from "@/lib/openai";
import { matchIngredient } from "@/lib/usda";
import { calcNutrientsFromUSDA } from "@/lib/nutrition";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("photo") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }

  // Upload to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${user.id}/${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;

  const { error: uploadError } = await adminSupabase.storage
    .from("meal-photos")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: urlData } = await adminSupabase.storage
    .from("meal-photos")
    .createSignedUrl(fileName, 60 * 60); // 1 hour signed URL for vision

  const photoPublicUrl = urlData?.signedUrl;

  if (!photoPublicUrl) {
    return NextResponse.json({ error: "Could not get photo URL" }, { status: 500 });
  }

  // Vision analysis
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: photoPublicUrl },
          },
          {
            type: "text",
            text: `Analyze this food photo. Identify all foods visible and estimate portion sizes.
Return ONLY JSON:
{
  "items": [
    {
      "name": "precise food name for USDA database lookup",
      "estimated_grams": number,
      "confidence": "high" | "medium" | "low"
    }
  ]
}
Be precise with names (e.g., "chicken breast, cooked" not just "chicken").
Use plate/utensil size as reference for portions.`,
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  let items: { name: string; estimated_grams: number; confidence: string }[] = [];
  try {
    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    items = parsed.items ?? [];
  } catch {
    return NextResponse.json({ error: "Failed to parse vision response" }, { status: 500 });
  }

  // Match each item to USDA and calculate macros
  const enrichedItems = await Promise.all(
    items.map(async (item, idx) => {
      const match = await matchIngredient(item.name);
      const macros = match
        ? calcNutrientsFromUSDA(match.per_100g, item.estimated_grams)
        : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

      return {
        id: `d${idx}`,
        name: item.name,
        estimatedQty: `${item.estimated_grams}g`,
        confidence: item.confidence as "high" | "medium" | "low",
        usdaMatch: match?.description ?? "Unknown",
        fdcId: match?.fdcId ?? null,
        calories: macros.calories,
        protein: macros.protein_g,
        carbs: macros.carbs_g,
        fat: macros.fat_g,
        removed: false,
      };
    })
  );

  // Get the permanent URL to return
  const { data: permanentUrl } = adminSupabase.storage
    .from("meal-photos")
    .getPublicUrl(fileName);

  return NextResponse.json({
    items: enrichedItems,
    photo_url: permanentUrl?.publicUrl ?? null,
  });
}
