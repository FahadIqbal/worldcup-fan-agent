"use client";
// src/components/ChatPanel.tsx — AI chat interface with streaming

import { useState, useRef, useEffect, useCallback } from "react";
import type { UserLocation } from "@/types/location";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  skillId?: string;
  toolsUsed?: string[];
}

interface QuickPrompt {
  icon: string;
  label: string;
  prompt: string;
}

function buildQuickPrompts(loc: UserLocation): QuickPrompt[] {
  const from = loc.city ? `${loc.city}, ${loc.country}` : "my city";
  const passport = loc.country ? `${loc.country} passport` : "my passport";
  const cur = loc.currency || "USD";
  const threshold =
    cur === "MYR" ? "MYR 4,000" :
    cur === "GBP" ? "£700" :
    cur === "EUR" ? "€800" :
    cur === "AUD" ? "A$1,400" :
    cur === "SGD" ? "SGD 1,200" :
    cur === "JPY" ? "¥130,000" :
    cur === "INR" ? "₹75,000" :
    cur === "BRL" ? "R$5,000" :
    "$900 USD";
  return [
    { icon: "✈️", label: "Plan my trip",     prompt: `I want to attend a World Cup 2026 match. I'm in ${from}. Help me plan a complete trip including flights, hotels, and match tickets.` },
    { icon: "🛬", label: "Visa check",        prompt: `Do I need a visa to enter the USA as a ${passport} holder for the World Cup 2026? What are the entry requirements?` },
    { icon: "🏨", label: "Find hotels",       prompt: `I'm flying from ${from} to a World Cup 2026 match. Find me mid-range hotels near the stadium.` },
    { icon: "🔔", label: "Price alert",       prompt: `Set a price alert for flights from ${from} to a World Cup 2026 venue city. Alert me when the price drops below ${threshold}.` },
    { icon: "🌤️", label: "Weather & packing", prompt: `What's the weather like in World Cup 2026 host cities in June–July? What should I pack travelling from ${from}?` },
    { icon: "⚽", label: "Fantasy picks",     prompt: `Give me World Cup 2026 fantasy league advice. Who should I captain this week — Mbappe, Vinicius Jr., or Bellingham?` },
  ];
}

const SKILL_LABELS: Record<string, string> = {
  "SK-01": "Trip Planner", "SK-02": "Price Monitor", "SK-03": "Visa Advisor",
  "SK-04": "Match Schedule", "SK-05": "Hotel Finder", "SK-06": "Fantasy Advisor",
  "SK-07": "Budget Tracker", "SK-08": "Fan Zone Finder", "SK-09": "Transport Planner",
  "SK-10": "Weather Advisor",
};

function genId() { return Math.random().toString(36).slice(2, 10); }
function formatTime(d: Date) { return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 0" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#00c896",
          display: "inline-block",
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:0.4}40%{transform:translateY(-6px);opacity:1}}`}</style>
    </div>
  );
}

function SkillBadge({ skillId }: { skillId: string }) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 20,
      background: "#0a1a12", border: "1px solid #00c89633",
      color: "#00c896", fontFamily: "inherit", letterSpacing: 0.5,
    }}>
      {SKILL_LABELS[skillId] ?? skillId}
    </span>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isAgent = msg.role === "agent";
  return (
    <div style={{
      display: "flex", flexDirection: isAgent ? "row" : "row-reverse",
      gap: 10, alignItems: "flex-start", marginBottom: 20,
      animation: "fadeUp 0.25s ease",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        background: isAgent
          ? "linear-gradient(135deg, #00c896, #0ea5e9)"
          : "linear-gradient(135deg, #8b5cf6, #ec4899)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, boxShadow: isAgent ? "0 0 12px #00c89644" : "0 0 12px #8b5cf644",
      }}>
        {isAgent ? "⚽" : "👤"}
      </div>

      <div style={{ maxWidth: "76%", display: "flex", flexDirection: "column", gap: 4 }}>
        {isAgent && msg.skillId && <SkillBadge skillId={msg.skillId} />}

        <div style={{
          padding: "12px 16px",
          borderRadius: isAgent ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
          background: isAgent ? "#0d1f14" : "#140d2a",
          border: isAgent ? "1px solid #00c89622" : "1px solid #8b5cf622",
          color: "#e2e8f0", fontSize: 13.5, lineHeight: 1.75,
          fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {msg.isStreaming ? <TypingIndicator /> : msg.content}
        </div>

        {isAgent && msg.toolsUsed && msg.toolsUsed.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {msg.toolsUsed.map((t) => (
              <span key={t} style={{
                fontSize: 10, padding: "1px 6px", borderRadius: 4,
                background: "#0a1020", border: "1px solid #1e2d50",
                color: "#64748b", fontFamily: "inherit",
              }}>
                🔧 {t}
              </span>
            ))}
          </div>
        )}

        <span style={{ fontSize: 10, color: "#334155", fontFamily: "inherit" }}>
          {formatTime(msg.timestamp)}
        </span>
      </div>
    </div>
  );
}

interface ChatPanelProps {
  userId: string;
  userLocation: UserLocation;
  initialPrompt?: string;
  onPromptConsumed?: () => void;
}

export default function ChatPanel({ userId, userLocation, initialPrompt, onPromptConsumed }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([{
    id: "welcome", role: "agent", timestamp: new Date(), skillId: "SK-01",
    content: "⚽ Welcome to the WorldCup Fan Command Center!\n\nI'm your AI travel and logistics agent for the 2026 FIFA World Cup across the USA, Canada, and Mexico.\n\nI can help you:\n✈  Plan your complete match trip\n📋  Check visa & entry requirements\n🏨  Find hotels near stadiums\n🔔  Set flight price alerts\n🌤  Check city weather & what to pack\n⚽  Get fantasy league advice\n\nWhere are you flying from, and which match are you hoping to attend?",
  }]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => genId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Fire a prompt that was injected from another tab (e.g. Fantasy quick-ask)
  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt);
      onPromptConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: genId(), role: "user", content: text.trim(), timestamp: new Date() };
    const placeholder: Message = { id: genId(), role: "agent", content: "", timestamp: new Date(), isStreaming: true };

    setMessages((prev) => [...prev, userMsg, placeholder]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), sessionId, userId, userLocation }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let skillId = "";
      let toolsUsed: string[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) fullText += parsed.token;
              if (parsed.skillId) skillId = parsed.skillId;
              if (parsed.tools) toolsUsed = parsed.tools;
            } catch {
              if (data !== "[DONE]") fullText += data + " ";
            }
            setMessages((prev) =>
              prev.map((m) => m.id === placeholder.id ? { ...m, content: fullText, isStreaming: true } : m)
            );
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholder.id
            ? {
                ...m,
                content: fullText || "I've processed your request. Is there anything else you'd like to know?",
                isStreaming: false,
                skillId: skillId || "SK-01",
                toolsUsed,
              }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholder.id
            ? { ...m, content: `Sorry, I ran into an issue: ${String(err)}\n\nPlease try again.`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading, sessionId, userId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'DM Mono', monospace" }}>
      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "20px 16px",
        scrollbarWidth: "thin", scrollbarColor: "#1e2d50 transparent",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Quick prompts — shown early in conversation */}
      {messages.length < 3 && (
        <div style={{ padding: "0 16px 10px", maxWidth: 760, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {buildQuickPrompts(userLocation).map((qp) => (
              <button key={qp.label} onClick={() => sendMessage(qp.prompt)} disabled={isLoading}
                style={{
                  padding: "6px 12px", borderRadius: 20, border: "1px solid #1e2d50",
                  background: "#0a0f1e", color: "#94a3b8", fontSize: 11, cursor: "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#00c89666"; (e.currentTarget as HTMLElement).style.color = "#00c896"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e2d50"; (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
              >
                {qp.icon} {qp.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "12px 16px 20px", borderTop: "1px solid #1e2d50" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{
            flex: 1, background: "#0a0f1e",
            border: `1px solid ${isLoading ? "#00c89644" : "#1e2d50"}`,
            borderRadius: 14, padding: "10px 14px", transition: "border-color 0.2s",
          }}>
            <textarea
              ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Ask anything… Plan a trip, check visa, set a price alert…"
              disabled={isLoading} rows={1}
              style={{
                width: "100%", background: "transparent", border: "none", outline: "none",
                color: "#e2e8f0", fontSize: 13, fontFamily: "inherit",
                resize: "none", maxHeight: 120, overflow: "auto", lineHeight: 1.6,
              }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
            />
          </div>
          <button
            onClick={() => sendMessage(input)} disabled={isLoading || !input.trim()}
            style={{
              width: 42, height: 42, borderRadius: 12, border: "none", fontSize: 16,
              background: isLoading || !input.trim() ? "#1e2d50" : "linear-gradient(135deg, #00c896, #0ea5e9)",
              color: "#fff", cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "all 0.2s",
              boxShadow: isLoading || !input.trim() ? "none" : "0 0 16px #00c89644",
            }}
          >
            {isLoading ? "⏳" : "↑"}
          </button>
        </div>
        <p style={{ textAlign: "center", margin: "8px 0 0", fontSize: 10, color: "#334155", fontFamily: "inherit" }}>
          Powered by Gemini 1.5 Pro · Tavily · Neon · Browserbase · Google Cloud Agent Builder
        </p>
      </div>

      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
