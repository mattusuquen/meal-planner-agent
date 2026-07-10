import { createClient } from "@/lib/supabase/server";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createChatAgent } from "@/lib/langchain/graphs/chatGraph";
import { SupabaseChatHistory } from "@/lib/langchain/memory/supabaseHistory";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const body = await request.json();
  const { message, sessionId: existingSessionId } = body as { message: string; sessionId?: string };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), { status: 400 });
  }

  // Ensure profile row exists (required by chat_sessions FK constraint)
  await supabase
    .from("profiles")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  // Get or create chat session
  let sessionId = existingSessionId;
  if (!sessionId) {
    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id })
      .select("id")
      .single();
    if (error || !session) {
      console.error("[POST /api/chat] session create error:", error?.message, error?.details, error?.hint);
      return new Response(JSON.stringify({ error: "Failed to create session" }), { status: 500 });
    }
    sessionId = session.id as string;
  }

  // Load message history
  const history = new SupabaseChatHistory({ supabase, sessionId, userId: user.id });
  const previousMessages = await history.getMessages();

  // Create agent
  const agent = createChatAgent(supabase, user.id);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ type: "session", sessionId });

        let fullText = "";

        const eventStream = agent.streamEvents(
          { messages: [...previousMessages, new HumanMessage(message)] },
          { version: "v2" }
        );

        for await (const event of eventStream) {
          // Stream text tokens from the agent's LLM calls
          if (
            event.event === "on_chat_model_stream" &&
            event.metadata?.langgraph_node === "agent"
          ) {
            const chunk = event.data?.chunk;
            const text =
              typeof chunk?.content === "string" ? chunk.content : "";
            if (text) {
              fullText += text;
              send({ type: "token", content: text });
            }
          }

          // Emit meal draft when parse_and_log_meal tool completes
          if (event.event === "on_tool_end") {
            try {
              const output = JSON.parse(
                (event.data?.output as string) ?? "{}"
              );
              if (output.status === "draft" && Array.isArray(output.items)) {
                send({ type: "meal_draft", draft: { items: output.items } });
              }
            } catch {
              // non-JSON tool output, ignore
            }
          }
        }

        // Persist human + assistant messages
        await history.addMessage(new HumanMessage(message));
        if (fullText) {
          await history.addMessage(new AIMessage(fullText));
        }

        send({ type: "done" });
      } catch (e) {
        console.error("[POST /api/chat]", e);
        send({ type: "error", message: "Something went wrong. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
