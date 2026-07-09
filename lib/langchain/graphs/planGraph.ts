/**
 * LangGraph pipeline for meal plan generation (Design Doc §12, Item 2).
 *
 * Nodes: generatePlan → validatePlan → savePlan
 * Retry edge: validatePlan → generatePlan (once, when Zod parse fails)
 */
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, MealPlanData } from "@/lib/types";

// ---------------------------------------------------------------------------
// Zod schemas (identical to those previously defined in the route handler)
// ---------------------------------------------------------------------------

const MealCellSchema = z.object({
  name: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  ingredients: z.array(z.string()).default([]),
  instructions: z.array(z.string()).default([]),
  description: z.string().default(""),
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

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const PlanState = Annotation.Root({
  // ── Inputs (set by the route handler before invoke) ──
  supabase: Annotation<SupabaseClient>(),
  userId: Annotation<string>(),
  weekStart: Annotation<string>(),
  days: Annotation<string[]>(),
  slots: Annotation<string[]>(),
  profile: Annotation<Profile | null>(),

  // ── Pipeline state ──
  rawOutput: Annotation<string | null>({
    value: (_, update) => update,
    default: () => null,
  }),
  planData: Annotation<MealPlanData | null>({
    value: (_, update) => update,
    default: () => null,
  }),
  attempts: Annotation<number>({
    value: (_, update) => update,
    default: () => 0,
  }),
  validationError: Annotation<string | null>({
    value: (_, update) => update,
    default: () => null,
  }),
  savedPlan: Annotation<unknown>({
    value: (_, update) => update,
    default: () => null,
  }),
  error: Annotation<string | null>({
    value: (_, update) => update,
    default: () => null,
  }),
});

type PlanStateType = typeof PlanState.State;

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

async function generatePlan(
  state: PlanStateType
): Promise<Partial<PlanStateType>> {
  const { profile, days, slots } = state;

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

Each meal object must include:
- name: meal name string
- calories, protein, carbs, fat: numeric macro estimates
- ingredients: array of 4–6 key ingredients as short strings (e.g. "Grilled chicken breast", "White quinoa", "Blueberries")
- instructions: array of 3–5 concise cooking steps (e.g. "Cook quinoa in water for 15 minutes", "Season and grill chicken for 6 minutes per side")
- description: one sentence explaining why this meal fits the goals (e.g. "Lean protein with easy-to-digest carbs to fuel recovery")

Keep meals varied, interesting, and accurate to the macro targets.`;

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.7,
    modelKwargs: { response_format: { type: "json_object" } },
  });

  const response = await model.invoke([
    ["system", systemPrompt],
    [
      "human",
      `Create a 7-day meal plan for the week starting ${state.weekStart}`,
    ],
  ]);

  const rawOutput =
    typeof response.content === "string" ? response.content : "{}";

  return { rawOutput, attempts: state.attempts + 1 };
}

async function validatePlan(
  state: PlanStateType
): Promise<Partial<PlanStateType>> {
  try {
    const result = PlanSchema.safeParse(JSON.parse(state.rawOutput ?? "{}"));
    if (result.success) {
      return { planData: result.data, validationError: null };
    }
    return {
      planData: null,
      validationError: result.error.issues
        .map((i) => i.message)
        .join("; "),
    };
  } catch (e) {
    return { planData: null, validationError: String(e) };
  }
}

async function savePlan(
  state: PlanStateType
): Promise<Partial<PlanStateType>> {
  const { supabase, userId, weekStart, planData } = state;

  // Archive any existing active plan for this week
  await supabase
    .from("meal_plans")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .eq("status", "active");

  const { data: plan, error } = await supabase
    .from("meal_plans")
    .insert({
      user_id: userId,
      week_start: weekStart,
      plan: planData,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("[planGraph/savePlan]", error.message, error.details);
    return { error: error.message };
  }

  return { savedPlan: plan };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

function routeAfterValidation(
  state: PlanStateType
): "savePlan" | "generatePlan" | typeof END {
  if (state.planData !== null) return "savePlan";
  if (state.attempts < 2) return "generatePlan"; // retry once
  return END; // max attempts reached — caller checks state.error
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export const planGraph = new StateGraph(PlanState)
  .addNode("generatePlan", generatePlan)
  .addNode("validatePlan", validatePlan)
  .addNode("savePlan", savePlan)
  .addEdge(START, "generatePlan")
  .addEdge("generatePlan", "validatePlan")
  .addConditionalEdges("validatePlan", routeAfterValidation)
  .addEdge("savePlan", END)
  .compile();
