import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { makeChatTools } from "@/lib/langchain/tools/chat";
import type { SupabaseClient } from "@supabase/supabase-js";

function buildSystemPrompt(todayDate: string): string {
  return `You are a helpful nutrition assistant for a meal planning and food tracking app.

Today's date is ${todayDate}. When the user says "today", "tonight", "this morning", etc., use ${todayDate}.

Your capabilities (always use tools — never guess numbers):
- Check calorie/macro progress → get_daily_totals
- Look up planned meals → get_meal_plan
- Swap a meal in the plan → swap_meal
- Log food by description → parse_and_log_meal, then confirm_log_meal after user confirms

CRITICAL RULES:
1. NEVER state a calorie or macro number that did not come from a tool result.
2. For food logging: call parse_and_log_meal first, show the user the items and ask for confirmation, then ONLY call confirm_log_meal after explicit user confirmation.
3. Keep responses concise and conversational.`;
}

export function createChatAgent(supabase: SupabaseClient, userId: string) {
  const todayDate = new Date().toLocaleDateString("en-CA");

  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.7,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const tools = makeChatTools(supabase, userId);

  return createReactAgent({
    llm,
    tools,
    stateModifier: buildSystemPrompt(todayDate),
  });
}
