import { ChatOpenAI } from "@langchain/openai";

export const chatModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  openAIApiKey: process.env.OPENAI_API_KEY,
});
