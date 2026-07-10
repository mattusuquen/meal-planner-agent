"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import ChatPanel from "@/components/chat/ChatPanel";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);
  const isOnboarding =
    pathname === "/onboarding" || pathname === "/" || pathname.startsWith("/auth");

  if (isOnboarding) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar onChatOpen={() => setChatOpen(true)} />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>
      <MobileNav onChatOpen={() => setChatOpen(true)} />

      {/* Desktop chat launcher button */}
      <button
        onClick={() => setChatOpen((v) => !v)}
        className="hidden md:flex fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 transition-colors items-center justify-center"
        aria-label="Open nutrition assistant"
      >
        {chatOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
