/**
 * Supabase-backed chat message history (Design Doc §12, Item 3).
 *
 * Implements BaseListChatMessageHistory backed by the chat_messages table.
 * Keyed by (userId, sessionId). Rolling window of the last 20 messages.
 * Not wired to any route yet — awaiting §13 conversational agent feature.
 *
 * Usage:
 *   const history = new SupabaseChatHistory({ supabase, sessionId, userId });
 *   const runnable = RunnableWithMessageHistory.from(chain, () => history);
 */
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
import type { SupabaseClient } from "@supabase/supabase-js";

const ROLLING_WINDOW = 20;

export class SupabaseChatHistory extends BaseListChatMessageHistory {
  lc_namespace = ["meal_planner", "chat_history"];

  private readonly supabase: SupabaseClient;
  private readonly sessionId: string;
  private readonly userId: string;

  constructor({
    supabase,
    sessionId,
    userId,
  }: {
    supabase: SupabaseClient;
    sessionId: string;
    userId: string;
  }) {
    super();
    this.supabase = supabase;
    this.sessionId = sessionId;
    this.userId = userId;
  }

  /**
   * Returns the last ROLLING_WINDOW messages in chronological order.
   * Durable facts (goals, targets, restrictions) must be sourced from
   * `profiles` by the calling code — not replayed from history.
   */
  async getMessages(): Promise<BaseMessage[]> {
    const { data, error } = await this.supabase
      .from("chat_messages")
      .select("role, content, tool_name, tool_result, created_at")
      .eq("session_id", this.sessionId)
      .order("created_at", { ascending: false })
      .limit(ROLLING_WINDOW);

    if (error) {
      console.error("[SupabaseChatHistory/getMessages]", error.message);
      return [];
    }

    if (!data?.length) return [];

    // Reverse DESC results to chronological order
    const chronological = [...data].reverse();

    // Map to LangChain StoredMessage shape then to BaseMessage
    const stored = chronological.map((row) => ({
      type: row.role as string,
      data: {
        content: row.content as string,
        role: row.role as string,
        name: undefined,
        tool_call_id: undefined,
        additional_kwargs:
          row.tool_name || row.tool_result
            ? { tool_name: row.tool_name, tool_result: row.tool_result }
            : {},
      },
    }));

    return mapStoredMessagesToChatMessages(stored);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const [stored] = mapChatMessagesToStoredMessages([message]);

    const { error: insertError } = await this.supabase
      .from("chat_messages")
      .insert({
        session_id: this.sessionId,
        role: stored.type,
        content:
          typeof stored.data.content === "string"
            ? stored.data.content
            : JSON.stringify(stored.data.content),
        tool_name: stored.data.additional_kwargs?.tool_name ?? null,
        tool_result: stored.data.additional_kwargs?.tool_result ?? null,
      });

    if (insertError) {
      console.error("[SupabaseChatHistory/addMessage]", insertError.message);
      return;
    }

    // Update session's last_message_at timestamp
    await this.supabase
      .from("chat_sessions")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", this.sessionId)
      .eq("user_id", this.userId);
  }

  async clear(): Promise<void> {
    const { error } = await this.supabase
      .from("chat_messages")
      .delete()
      .eq("session_id", this.sessionId);

    if (error) {
      console.error("[SupabaseChatHistory/clear]", error.message);
    }
  }
}
