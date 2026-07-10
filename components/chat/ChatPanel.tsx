"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MealItem {
  name: string;
  estimatedQty: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealDraft {
  items: MealItem[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  mealDraft?: MealDraft;
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;
type Slot = (typeof SLOTS)[number];

const SUGGESTED_PROMPTS = [
  "How many calories do I have left today?",
  "What's for dinner tonight?",
  "Log 2 eggs and a slice of toast",
  "Swap my lunch for something lighter",
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatPanel({ open, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot>("Breakfast");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 112) + "px";
  };

  const sendMessage = useCallback(
    async (override?: string) => {
      const text = (override ?? input).trim();
      if (!text || isLoading) return;

      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto";
      setIsLoading(true);

      const userMsgId = `u-${Date.now()}`;
      const assistantMsgId = `a-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: text },
        { id: assistantMsgId, role: "assistant", content: "", streaming: true },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, sessionId }),
        });

        if (!res.ok || !res.body) throw new Error("Request failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === "session") {
                setSessionId(event.sessionId);
              } else if (event.type === "token") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                );
              } else if (event.type === "meal_draft") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, mealDraft: event.draft as MealDraft }
                      : m
                  )
                );
              } else if (event.type === "done" || event.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          streaming: false,
                          content:
                            event.type === "error"
                              ? (event.message as string)
                              : m.content,
                        }
                      : m
                  )
                );
              }
            } catch {
              // malformed SSE line
            }
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  streaming: false,
                  content: "Sorry, something went wrong. Please try again.",
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, sessionId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleConfirmLog = (msg: ChatMessage, slot: Slot) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, mealDraft: undefined } : m))
    );
    sendMessage(`Yes, log all of that to my ${slot}.`);
  };

  const handleDismissDraft = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, mealDraft: undefined } : m))
    );
  };

  if (!open) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={[
          "fixed z-50 flex flex-col bg-white",
          // Mobile: bottom sheet
          "inset-x-0 bottom-0 h-[88vh] rounded-t-3xl shadow-2xl",
          // Desktop: floating side panel
          "md:inset-auto md:bottom-6 md:right-6 md:w-[380px] md:h-[620px] md:rounded-2xl md:border md:border-gray-100",
        ].join(" ")}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">
                Nutrition Assistant
              </p>
              <p className="text-[11px] text-gray-400 leading-tight">
                USDA-grounded · never guesses nutrition
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  setSessionId(null);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="New conversation"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center pt-4 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-brand-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">
                  What can I help with?
                </p>
                <p className="text-xs text-gray-400 mt-0.5 max-w-[200px]">
                  All nutrition data comes from USDA — never estimated.
                </p>
              </div>
              <div className="w-full grid grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl px-3 py-2.5 transition-colors leading-snug"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {/* Bubble row */}
              <div
                className={`flex items-end gap-2 w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0 mb-0.5">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                )}
                <div
                  className={[
                    "max-w-[82%] rounded-2xl px-3.5 py-2.5",
                    msg.role === "user"
                      ? "bg-brand-600 text-white rounded-br-sm text-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm",
                  ].join(" ")}
                >
                  {msg.role === "assistant" ? (
                    msg.content ? (
                      renderMarkdown(msg.content)
                    ) : msg.streaming ? (
                      <TypingDots />
                    ) : null
                  ) : (
                    <span className="text-sm">{msg.content}</span>
                  )}
                </div>
              </div>

              {/* Inline meal confirmation card */}
              {msg.mealDraft && !msg.streaming && (
                <div className="mt-2 ml-8 w-full max-w-[82%]">
                  <MealConfirmCard
                    draft={msg.mealDraft}
                    selectedSlot={selectedSlot}
                    onSlotChange={setSelectedSlot}
                    onConfirm={() => handleConfirmLog(msg, selectedSlot)}
                    onDismiss={() => handleDismissDraft(msg.id)}
                  />
                </div>
              )}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 pt-2.5 pb-4 border-t border-gray-100 bg-white rounded-b-3xl md:rounded-b-2xl">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your nutrition..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all disabled:opacity-60 overflow-hidden"
              style={{ minHeight: "40px", maxHeight: "112px" }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 12h14M12 5l7 7-7 7"
                  />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-300 mt-1.5 text-center select-none">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="flex gap-1 items-center h-4 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

// ─── Meal confirmation card ───────────────────────────────────────────────────

interface MealConfirmCardProps {
  draft: MealDraft;
  selectedSlot: Slot;
  onSlotChange: (slot: Slot) => void;
  onConfirm: () => void;
  onDismiss: () => void;
}

function MealConfirmCard({
  draft,
  selectedSlot,
  onSlotChange,
  onConfirm,
  onDismiss,
}: MealConfirmCardProps) {
  const totalCals = Math.round(draft.items.reduce((s, i) => s + i.calories, 0));
  const totalProtein = Math.round(
    draft.items.reduce((s, i) => s + i.protein, 0)
  );

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3.5 pt-3 pb-1.5 border-b border-gray-100">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          Ready to log
        </p>
      </div>

      {/* Items */}
      <div className="px-3.5 py-2.5 space-y-2.5">
        {draft.items.map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 leading-snug">
                {item.name}
              </p>
              <p className="text-[11px] text-gray-400">{item.estimatedQty}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-xs font-semibold text-gray-700">
                {item.calories} kcal
              </p>
              <p className="text-[11px] text-gray-400">{item.protein}g pro</p>
            </div>
          </div>
        ))}
      </div>

      {/* Totals row */}
      <div className="mx-3.5 pt-2 pb-2.5 border-t border-dashed border-gray-100 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-500">Total</span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-800">
            {totalCals} kcal
          </span>
          <span className="text-[11px] text-gray-500">
            {totalProtein}g protein
          </span>
        </div>
      </div>

      {/* Slot selector */}
      <div className="px-3.5 pb-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Log to
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {SLOTS.map((slot) => (
            <button
              key={slot}
              onClick={() => onSlotChange(slot)}
              className={[
                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                selectedSlot === slot
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              ].join(" ")}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex border-t border-gray-100">
        <button
          onClick={onDismiss}
          className="flex-1 py-3 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <div className="w-px bg-gray-100" />
        <button
          onClick={onConfirm}
          className="flex-1 py-3 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
        >
          Log to {selectedSlot}
        </button>
      </div>
    </div>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  // Handle **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!listItems.length) return;
    nodes.push(
      <ul
        key={key++}
        className="list-disc list-inside space-y-0.5 my-1 text-sm"
      >
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const listMatch = line.match(/^[-*•]\s+(.+)/);
    if (listMatch) {
      listItems.push(listMatch[1]);
    } else {
      flushList();
      if (line.trim() === "") {
        nodes.push(<div key={key++} className="h-1" />);
      } else {
        nodes.push(
          <p key={key++} className="text-sm leading-relaxed">
            {renderInline(line)}
          </p>
        );
      }
    }
  }

  flushList();
  return <div className="space-y-0.5">{nodes}</div>;
}
