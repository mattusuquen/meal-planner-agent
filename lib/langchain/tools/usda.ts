import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchUSDA, matchIngredient, getOrFetchAndCache } from "@/lib/usda";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Singleton tool — no Supabase client needed.
 * Wraps searchUSDA() for use in tool-calling agent loops.
 */
export const searchUSDAFoodsTool = tool(
  async ({ query, limit }) => {
    const results = await searchUSDA(query, limit ?? 8);
    return JSON.stringify(results);
  },
  {
    name: "search_usda_foods",
    description:
      "Search the USDA FoodData Central database for foods matching a query. Returns fdcId, description, and per-100g macros.",
    schema: z.object({
      query: z.string().describe("Food name to search for"),
      limit: z.number().int().optional().describe("Max results, default 8"),
    }),
  }
);

/**
 * Factory — returns Supabase-bound tools for ingredient matching and nutrition lookup.
 * Call once per request with the route's Supabase client.
 */
export function makeUSDATools(supabase: SupabaseClient) {
  const matchIngredientTool = tool(
    async ({ rawText }) => {
      const result = await matchIngredient(rawText, supabase);
      return JSON.stringify(result ?? null);
    },
    {
      name: "match_ingredient",
      description:
        "Match a raw ingredient text to its best USDA entry and cache the result. Returns fdcId, description, and per_100g macros.",
      schema: z.object({
        rawText: z
          .string()
          .describe("Raw ingredient text, e.g. 'chicken breast'"),
      }),
    }
  );

  const getOrFetchNutritionTool = tool(
    async ({ fdcId }) => {
      const result = await getOrFetchAndCache(fdcId, supabase);
      return JSON.stringify(result ?? null);
    },
    {
      name: "get_or_fetch_nutrition",
      description:
        "Fetch nutrition data for a USDA fdcId, using the local cache when available.",
      schema: z.object({
        fdcId: z.number().int().describe("USDA FoodData Central food ID"),
      }),
    }
  );

  return [matchIngredientTool, getOrFetchNutritionTool] as const;
}
