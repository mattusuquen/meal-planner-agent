import { createClient } from "@/lib/supabase/server";
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

  const { text } = await request.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Parse the food description into individual items with estimated weights.
Return ONLY JSON:
{
  "items": [
    {
      "name": "precise food name for USDA lookup",
      "quantity": number,
      "unit": string,
      "estimated_grams": number,
      "confidence": "high" | "medium" | "low"
    }
  ]
}`,
      },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
    max_tokens: 400,
  });

  let items: { name: string; quantity: number; unit: string; estimated_grams: number; confidence: string }[] = [];
  try {
    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    items = parsed.items ?? [];
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }

  // Match each item to USDA
  const enrichedItems = await Promise.all(
    items.map(async (item, idx) => {
      const match = await matchIngredient(item.name, supabase);
      const macros = match
        ? calcNutrientsFromUSDA(match.per_100g, item.estimated_grams)
        : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

      return {
        id: `t${idx}`,
        name: item.name,
        estimatedQty: `${item.quantity} ${item.unit}`,
        confidence: item.confidence as "high" | "medium" | "low",
        usdaMatch: match?.description ?? "Unknown",
        fdcId: match?.fdcId ?? null,
        calories: macros.calories,
        protein: macros.protein_g,
        carbs: macros.carbs_g,
        fat: macros.fat_g,
        removed: false,
        estimated_grams: item.estimated_grams,
      };
    })
  );

  return NextResponse.json({ items: enrichedItems });
}
