import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchIngredient } from "@/lib/usda";
import { calcNutrientsFromUSDA, recalcDailyTotals } from "@/lib/nutrition";
import { openai } from "@/lib/openai";

function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function makeChatTools(supabase: SupabaseClient, userId: string) {
  const getDailyTotalsTool = tool(
    async ({ date }) => {
      const targetDate = date ?? today();
      const [{ data: totals }, { data: profile }] = await Promise.all([
        supabase.from("daily_totals").select("*").eq("user_id", userId).eq("date", targetDate).maybeSingle(),
        supabase.from("profiles").select("calorie_target, protein_g, carbs_g, fat_g").eq("id", userId).single(),
      ]);
      return JSON.stringify({
        date: targetDate,
        logged: totals ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, meals_logged: 0 },
        targets: {
          calories: profile?.calorie_target ?? 2000,
          protein_g: profile?.protein_g ?? 150,
          carbs_g: profile?.carbs_g ?? 200,
          fat_g: profile?.fat_g ?? 65,
        },
        remaining: {
          calories: (profile?.calorie_target ?? 2000) - (totals?.calories ?? 0),
          protein_g: (profile?.protein_g ?? 150) - (totals?.protein_g ?? 0),
          carbs_g: (profile?.carbs_g ?? 200) - (totals?.carbs_g ?? 0),
          fat_g: (profile?.fat_g ?? 65) - (totals?.fat_g ?? 0),
        },
      });
    },
    {
      name: "get_daily_totals",
      description:
        "Get today's (or a specific date's) calorie and macro totals vs. targets. Use this whenever the user asks about remaining calories, macros logged, or progress.",
      schema: z.object({
        date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today."),
      }),
    }
  );

  const getMealPlanTool = tool(
    async ({ date }) => {
      const targetDate = date ?? today();
      const { data: plan } = await supabase
        .from("meal_plans")
        .select("id, plan, week_start")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!plan) return JSON.stringify({ error: "No active meal plan found" });
      const dayMeals = plan.plan?.[targetDate];
      if (!dayMeals) return JSON.stringify({ date: targetDate, meals: null, note: "No plan for this date" });
      return JSON.stringify({ date: targetDate, plan_id: plan.id, meals: dayMeals });
    },
    {
      name: "get_meal_plan",
      description:
        "Get the planned meals for today or a specific date from the user's active meal plan.",
      schema: z.object({
        date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today."),
      }),
    }
  );

  const swapMealTool = tool(
    async ({ date, slot, constraints }) => {
      const targetDate = date ?? today();
      const { data: mealPlan } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!mealPlan) return JSON.stringify({ error: "No active meal plan found" });

      const { data: profile } = await supabase
        .from("profiles")
        .select("calorie_target, protein_g, carbs_g, fat_g, dietary_restrictions, allergies")
        .eq("id", userId)
        .single();

      const dayPlan = mealPlan.plan[targetDate] ?? {};
      const consumed = Object.entries(dayPlan)
        .filter(([s]) => s !== slot)
        .reduce(
          (acc, [, meal]) => {
            if (!meal) return acc;
            const m = meal as { calories: number; protein: number; carbs: number; fat: number };
            return {
              calories: acc.calories + (m.calories ?? 0),
              protein: acc.protein + (m.protein ?? 0),
              carbs: acc.carbs + (m.carbs ?? 0),
              fat: acc.fat + (m.fat ?? 0),
            };
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

      const remaining = {
        calories: (profile?.calorie_target ?? 2000) - consumed.calories,
        protein: (profile?.protein_g ?? 150) - consumed.protein,
        carbs: (profile?.carbs_g ?? 200) - consumed.carbs,
        fat: (profile?.fat_g ?? 65) - consumed.fat,
      };

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a nutritionist. Suggest a replacement ${slot} meal.
${profile?.dietary_restrictions?.length ? `Restrictions: ${profile.dietary_restrictions.join(", ")}` : ""}
${profile?.allergies?.length ? `Avoid: ${profile.allergies.join(", ")}` : ""}
${constraints ? `User request: ${constraints}` : ""}
Remaining budget: ${remaining.calories} cal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat.
Return ONLY JSON: { "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": string[], "instructions": string[], "description": string }`,
          },
          { role: "user", content: `Suggest a different ${slot} option.` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9,
      });

      const newMeal = JSON.parse(completion.choices[0].message.content ?? "{}");

      const updatedPlan = {
        ...mealPlan.plan,
        [targetDate]: { ...(mealPlan.plan[targetDate] ?? {}), [slot]: { ...newMeal, image_url: undefined } },
      };

      const { error } = await supabase
        .from("meal_plans")
        .update({ plan: updatedPlan })
        .eq("id", mealPlan.id)
        .eq("user_id", userId);

      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, newMeal, date: targetDate, slot });
    },
    {
      name: "swap_meal",
      description:
        "Replace a meal in the user's plan with an AI-generated alternative that fits the remaining daily macro budget.",
      schema: z.object({
        date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today."),
        slot: z.enum(["Breakfast", "Lunch", "Dinner", "Snacks"]),
        constraints: z.string().optional().describe("Optional user preference, e.g. 'higher protein' or 'vegetarian'."),
      }),
    }
  );

  const parseAndLogMealTool = tool(
    async ({ freeText }) => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Parse the food description into individual items with estimated weights.
Return ONLY JSON: { "items": [{ "name": string, "quantity": number, "unit": string, "estimated_grams": number, "confidence": "high"|"medium"|"low" }] }`,
          },
          { role: "user", content: freeText },
        ],
        response_format: { type: "json_object" },
        max_tokens: 400,
      });

      let rawItems: { name: string; quantity: number; unit: string; estimated_grams: number; confidence: string }[] = [];
      try {
        rawItems = JSON.parse(completion.choices[0].message.content ?? "{}").items ?? [];
      } catch {
        return JSON.stringify({ error: "Failed to parse food description" });
      }

      const enrichedItems = await Promise.all(
        rawItems.map(async (item, idx) => {
          const match = await matchIngredient(item.name, supabase);
          const macros = match
            ? calcNutrientsFromUSDA(match.per_100g, item.estimated_grams)
            : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
          return {
            id: `t${idx}`,
            name: item.name,
            estimatedQty: `${item.quantity} ${item.unit}`,
            confidence: item.confidence,
            usdaMatch: match?.description ?? "Unknown",
            fdcId: match?.fdcId ?? null,
            calories: macros.calories,
            protein: macros.protein_g,
            carbs: macros.carbs_g,
            fat: macros.fat_g,
            estimated_grams: item.estimated_grams,
          };
        })
      );

      return JSON.stringify({
        items: enrichedItems,
        totalCalories: enrichedItems.reduce((s, i) => s + i.calories, 0),
        totalProtein: enrichedItems.reduce((s, i) => s + i.protein, 0),
        status: "draft",
        instruction: "Present these items to the user with their macros. Ask which meal slot and confirm before logging.",
      });
    },
    {
      name: "parse_and_log_meal",
      description:
        "Parse a free-text food description into USDA-verified items with macros. Returns a draft for user review — does NOT log. Always present results to user and wait for confirmation before calling confirm_log_meal.",
      schema: z.object({
        freeText: z.string().describe("Free-text food description, e.g. '2 scrambled eggs and a slice of toast'."),
      }),
    }
  );

  const confirmLogMealTool = tool(
    async ({ items, mealSlot, loggedDate }) => {
      const targetDate = loggedDate ?? today();
      await supabase.from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });

      const { error } = await supabase.from("logged_meals").insert(
        items.map((item) => ({
          user_id: userId,
          logged_date: targetDate,
          meal_slot: mealSlot,
          entry_method: "text",
          servings: 1,
          recipe_id: null,
          custom_entry: {
            name: item.name,
            calories: item.calories,
            protein_g: item.protein,
            carbs_g: item.carbs,
            fat_g: item.fat,
          },
          photo_url: null,
        }))
      );

      if (error) return JSON.stringify({ error: error.message });

      let daily_totals;
      try {
        daily_totals = await recalcDailyTotals(supabase, userId, targetDate);
      } catch {
        // non-fatal
      }

      return JSON.stringify({ success: true, logged: items.length, date: targetDate, slot: mealSlot, new_totals: daily_totals ?? null });
    },
    {
      name: "confirm_log_meal",
      description:
        "Log confirmed meal items to the food diary. Only call after the user has explicitly confirmed the items from parse_and_log_meal.",
      schema: z.object({
        items: z
          .array(z.object({ name: z.string(), calories: z.number(), protein: z.number(), carbs: z.number(), fat: z.number() }))
          .describe("Items to log, as returned by parse_and_log_meal."),
        mealSlot: z.enum(["Breakfast", "Lunch", "Dinner", "Snacks"]),
        loggedDate: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today."),
      }),
    }
  );

  return [getDailyTotalsTool, getMealPlanTool, swapMealTool, parseAndLogMealTool, confirmLogMealTool];
}
