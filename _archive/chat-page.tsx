"use client";
// app/chat/page.tsx
// WorldCup Fan Command Center — Main Chat UI

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

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

const QUICK_PROMPTS: QuickPrompt[] = [
  { icon: "✈️", label: "Plan my trip", prompt: "I want to attend a World Cup 2026 match. I'm in Kuala Lumpur, Malaysia. Help me plan a trip to see a match in Dallas." },
  { icon: "🛬", label: "Visa check", prompt: "Do I need a visa to enter the USA as a Malaysian passport holder for the World Cup?" },
  { icon: "🏨", label: "Find hotels", prompt: "Find me hotels near AT&T Stadium in Dallas for match week, mid-range budget." },
  { icon: "🔔", label: "Price alert", prompt: "Alert me when flights from Kuala Lumpur to Dallas drop below $900 USD." },
  { icon: "🌤️", label: "Weather", prompt: "What's the weather like in Dallas in June? What should I pack?" },
  { icon: "⚽", label: "Fantasy advice", prompt: "Should I captain Mbappe or Vinicius Jr. this week in my World Cup fantasy league?" },
];

const SKILL_LABELS: Record<string, string> = {
  "SK-01": "Trip Planner",
  "SK-02": "Price Monitor",
  "SK-03": "Visa Advisor",
  "SK-04": "Match Schedule",
  "SK-05": "Hotel Finder",
  "SK-06": "Fantasy Advisor",
  "SK-07": "Budget Tracker",
  "SK-08": "Fan Zone Finder",
  "SK-09": "Transport Planner",
  "SK-10": "Weather Advisor",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Sub-components ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 0" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#00c896",
            display: "inline-block",
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%,80%,100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function SkillBadge({ skillId }: { skillId: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 20,
        background: "#0a1a12",
        border: "1px solid #00c89633",
        color: "#00c896",
        fontFamily: "'DM Mono', monospace",
        letterSpacing: 0.5,
      }}
    >
      {SKILL_LABELS[skillId] ?? skillId}
    </span>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isAgent = msg.role === "agent";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isAgent ? "row" : "row-reverse",
        gap: 10,
        alignItems: "flex-start",
        marginBottom: 20,
        animation: "fadeUp 0.25s ease",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: isAgent
            ? "linear-gradient(135deg, #00c896, #0ea5e9)"
            : "linear-gradient(135deg, #8b5cf6, #ec4899)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          flexShrink: 0,
          boxShadow: isAgent ? "0 0 12px #00c89644" : "0 0 12px #8b5cf644",
        }}
      >
        {isAgent ? "⚽" : "👤"}
      </div>

      <div style={{ maxWidth: "76%", display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Skill badge */}
        {isAgent && msg.skillId && <SkillBadge skillId={msg.skillId} />}

        {/* Bubble */}
        <div
          style={{
            padding: "12px 16px",
            borderRadius: isAgent ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
            background: isAgent ? "#0d1f14" : "#140d2a",
            border: isAgent ? "1px solid #00c89622" : "1px solid #8b5cf622",
            color: "#e2e8f0",
            fontSize: 13.5,
            lineHeight: 1.75,
            fontFamily: "'DM Mono', monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {msg.isStreaming ? <TypingIndicator /> : msg.content}
        </div>

        {/* Tools used */}
        {isAgent && msg.toolsUsed && msg.toolsUsed.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {msg.toolsUsed.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "#0a1020",
                  border: "1px solid #1e2d50",
                  color: "#64748b",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                🔧 {t}
              </span>
            ))}
          </div>
        )}

        <span style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Mono', monospace" }}>
          {formatTime(msg.timestamp)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      content:
        "⚽ Welcome to the WorldCup Fan Command Center!\n\nI'm your AI travel and logistics agent for the 2026 FIFA World Cup across the USA, Canada, and Mexico.\n\nI can help you:\n✈  Plan your complete match trip\n📋  Check visa & entry requirements\n🏨  Find hotels near stadiums\n🔔  Set flight price alerts\n🌤  Check city weather & what to pack\n⚽  Get fantasy league advice\n\nWhere are you flying from, and which match are you hoping to attend?",
      timestamp: new Date(),
      skillId: "SK-01",
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => genId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = {
        id: genId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      const agentPlaceholder: Message = {
        id: genId(),
        role: "agent",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, agentPlaceholder]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            sessionId,
            userId: "demo-user", // replace with Firebase Auth UID
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Stream response
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
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") break;

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.token) fullText += parsed.token;
                  if (parsed.skillId) skillId = parsed.skillId;
                  if (parsed.tools) toolsUsed = parsed.tools;
                } catch {
                  // Plain text token
                  if (data !== "[DONE]") fullText += data + " ";
                }

                // Update streaming message
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentPlaceholder.id
                      ? { ...m, content: fullText, isStreaming: true }
                      : m
                  )
                );
              }
            }
          }
        }

        // Finalise message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentPlaceholder.id
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
            m.id === agentPlaceholder.id
              ? {
                  ...m,
                  content: `Sorry, I ran into an issue: ${String(err)}\n\nPlease try again or check your connection.`,
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [isLoading, sessionId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "#060b14",
        color: "#e2e8f0",
        fontFamily: "'DM Mono', monospace",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, #00c89614 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 80% 80%, #3b82f614 0%, transparent 50%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Header */}
      <header
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #1e2d50",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#060b14ee",
          backdropFilter: "blur(12px)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #00c896, #0ea5e9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            boxShadow: "0 0 20px #00c89644",
          }}
        >
          ⚽
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", letterSpacing: "-0.3px" }}>
            WorldCup Fan Command Center
          </div>
          <div style={{ fontSize: 10, color: "#00c896", letterSpacing: 1 }}>
            POWERED BY GEMINI 1.5 PRO · GOOGLE CLOUD AGENT BUILDER
          </div>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 20,
            background: "#0a1a12",
            border: "1px solid #00c89633",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#00c896",
              boxShadow: "0 0 6px #00c896",
              display: "inline-block",
              animation: "pulse 2s ease infinite",
            }}
          />
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>
          <span style={{ fontSize: 10, color: "#00c896", letterSpacing: 1 }}>AGENT ONLINE</span>
        </div>
      </header>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px",
          position: "relative",
          zIndex: 1,
          scrollbarWidth: "thin",
          scrollbarColor: "#1e2d50 transparent",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Quick prompts */}
      {messages.length < 3 && (
        <div
          style={{
            padding: "0 16px 10px",
            maxWidth: 760,
            margin: "0 auto",
            width: "100%",
            zIndex: 2,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.label}
                onClick={() => sendMessage(qp.prompt)}
                disabled={isLoading}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: "1px solid #1e2d50",
                  background: "#0a0f1e",
                  color: "#94a3b8",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "'DM Mono', monospace",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.borderColor = "#00c89666";
                  (e.target as HTMLElement).style.color = "#00c896";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.borderColor = "#1e2d50";
                  (e.target as HTMLElement).style.color = "#94a3b8";
                }}
              >
                {qp.icon} {qp.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: "12px 16px 20px",
          borderTop: "1px solid #1e2d50",
          background: "#060b14ee",
          backdropFilter: "blur(12px)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "#0a0f1e",
              border: `1px solid ${isLoading ? "#00c89644" : "#1e2d50"}`,
              borderRadius: 14,
              padding: "10px 14px",
              transition: "border-color 0.2s",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything… Plan a trip, check visa, set a price alert…"
              disabled={isLoading}
              rows={1}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#e2e8f0",
                fontSize: 13,
                fontFamily: "'DM Mono', monospace",
                resize: "none",
                maxHeight: 120,
                overflow: "auto",
                lineHeight: 1.6,
              }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
            />
          </div>

          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: "none",
              background:
                isLoading || !input.trim()
                  ? "#1e2d50"
                  : "linear-gradient(135deg, #00c896, #0ea5e9)",
              color: "#fff",
              fontSize: 16,
              cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.2s",
              boxShadow:
                isLoading || !input.trim() ? "none" : "0 0 16px #00c89644",
            }}
          >
            {isLoading ? "⏳" : "↑"}
          </button>
        </div>

        <p
          style={{
            textAlign: "center",
            margin: "8px 0 0",
            fontSize: 10,
            color: "#334155",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          Powered by Gemini 1.5 Pro · Tavily · Neon · Browserbase · Google Cloud Agent Builder
        </p>
      </div>
    </div>
  );
}
