"use client";
// src/components/ChatPanel.tsx — AI chat interface with streaming

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UserLocation } from "@/types/location";
import { getTopPrompts } from "@/lib/quickPrompts";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  skillId?: string;
  toolsUsed?: string[];
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
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 0" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "var(--accent, #00c896)",
          display: "inline-block", opacity: 0.7,
          animation: `bounce 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  );
}

function SkillBadge({ skillId }: { skillId: string }) {
  return (
    <span style={{
      fontSize: 9, padding: "2px 9px", borderRadius: 20,
      background: "var(--accent-dim, #00c89618)",
      border: "1px solid var(--accent-border, #00c89630)",
      color: "var(--accent, #00c896)",
      fontFamily: "var(--font-mono, monospace)",
      letterSpacing: "0.07em", fontWeight: 500,
    }}>
      {SKILL_LABELS[skillId] ?? skillId}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(el);
        el.focus(); el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      } catch { /* silent in restricted environments */ }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={copy} title="Copy response" style={{
      padding: "3px 9px", borderRadius: 6,
      border: `1px solid ${copied ? "var(--accent-border)" : "var(--border)"}`,
      background: copied ? "var(--accent-dim)" : "transparent",
      color: copied ? "var(--accent)" : "var(--text3)",
      fontSize: 10, cursor: "pointer",
      fontFamily: "var(--font-mono)",
      transition: "all 0.15s", flexShrink: 0, letterSpacing: "0.04em",
    }}>
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isAgent = msg.role === "agent";
  return (
    <div style={{
      display: "flex", flexDirection: isAgent ? "row" : "row-reverse",
      gap: 12, alignItems: "flex-start", marginBottom: 24,
      animation: "fadeUp 0.22s ease",
    }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: isAgent
          ? "linear-gradient(135deg, #00c896 0%, #0ea5e9 100%)"
          : "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15,
        boxShadow: isAgent
          ? "0 0 0 1px #00c89625, 0 2px 8px #00c89625"
          : "0 0 0 1px #7c3aed25, 0 2px 8px #7c3aed20",
        marginTop: 2,
      }}>
        {isAgent ? "⚽" : "👤"}
      </div>

      {/* Content */}
      <div style={{ maxWidth: "calc(100% - 56px)", minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        {/* Skill badge + name row */}
        {isAgent && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {msg.skillId && <SkillBadge skillId={msg.skillId} />}
          </div>
        )}

        {/* Bubble */}
        <div style={{
          padding: "13px 17px",
          borderRadius: isAgent ? "2px 14px 14px 14px" : "14px 2px 14px 14px",
          background: isAgent ? "var(--surface, #0d1825)" : "var(--surface2, #101f30)",
          border: isAgent
            ? "1px solid var(--border, #1a2d4a)"
            : "1px solid var(--border2, #243a55)",
          boxShadow: isAgent
            ? "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)"
            : "0 1px 3px rgba(0,0,0,0.3)",
          color: "var(--text, #f1f5f9)",
          fontSize: 14, lineHeight: 1.7,
          fontFamily: "var(--font-sans, 'Inter', sans-serif)",
          wordBreak: "break-word",
          position: "relative",
        }}>
          {isAgent && (
            <div style={{
              position: "absolute", left: 0, top: 12, bottom: 12,
              width: 2, borderRadius: 2,
              background: "linear-gradient(to bottom, var(--accent), transparent)",
              opacity: 0.5,
            }} />
          )}
          {msg.isStreaming ? <TypingIndicator /> : isAgent ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)", margin: "6px 0 10px", borderBottom: "1px solid var(--accent-border)", paddingBottom: 7, letterSpacing: "-0.3px" }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: 14.5, fontWeight: 600, color: "var(--accent)", margin: "12px 0 6px", letterSpacing: "-0.2px" }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: 13.5, fontWeight: 600, color: "var(--blue, #38bdf8)", margin: "10px 0 5px" }}>{children}</h3>,
                p: ({ children }) => <p style={{ margin: "0 0 8px", lineHeight: 1.7 }}>{children}</p>,
                strong: ({ children }) => <strong style={{ color: "var(--text)", fontWeight: 600 }}>{children}</strong>,
                em: ({ children }) => <em style={{ color: "var(--text2)", fontStyle: "italic" }}>{children}</em>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)", textDecoration: "none", borderBottom: "1px solid var(--blue-dim, #38bdf820)" }}>{children}</a>,
                blockquote: ({ children }) => <blockquote style={{ borderLeft: "3px solid var(--accent-border)", paddingLeft: 12, margin: "10px 0", color: "var(--text2)", fontStyle: "italic" }}>{children}</blockquote>,
                hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />,
                ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: "4px 0 10px" }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: "4px 0 10px" }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 4, lineHeight: 1.6 }}>{children}</li>,
                table: ({ children }) => <div style={{ overflowX: "auto", margin: "8px 0" }}><table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>{children}</table></div>,
                th: ({ children }) => <th style={{ padding: "6px 10px", textAlign: "left", background: "var(--surface2)", color: "var(--text2)", fontWeight: 600, fontSize: 11, letterSpacing: "0.06em", borderBottom: "1px solid var(--border2)" }}>{children}</th>,
                td: ({ children }) => <td style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--text)" }}>{children}</td>,
                code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) => inline
                  ? <code style={{ background: "var(--bg, #060b14)", border: "1px solid var(--border2)", borderRadius: 4, padding: "1px 6px", fontSize: 12, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{children}</code>
                  : <pre style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", overflowX: "auto", fontSize: 12, margin: "8px 0", fontFamily: "var(--font-mono)" }}><code style={{ color: "var(--text2)" }}>{children}</code></pre>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          ) : (
            <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
          )}
        </div>

        {/* Tool tags */}
        {isAgent && msg.toolsUsed && msg.toolsUsed.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {msg.toolsUsed.map((t) => (
              <span key={t} style={{
                fontSize: 9.5, padding: "2px 7px", borderRadius: 4,
                background: "var(--bg)", border: "1px solid var(--border)",
                color: "var(--text3)", fontFamily: "var(--font-mono)",
              }}>
                ⚙ {t}
              </span>
            ))}
          </div>
        )}

        {/* Footer: timestamp + copy */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "var(--text4)", fontFamily: "var(--font-mono)" }}>
            {formatTime(msg.timestamp)}
          </span>
          {isAgent && !msg.isStreaming && msg.content.length > 20 && (
            <CopyButton text={msg.content} />
          )}
        </div>
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
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const daysToWC = Math.max(0, Math.ceil((new Date("2026-06-11").getTime() - Date.now()) / 86400000));
    const wcIsOn = Date.now() >= new Date("2026-06-11").getTime() && Date.now() <= new Date("2026-07-19").getTime();

    const welcomeContent = wcIsOn
      ? "🔴 **World Cup 2026 is LIVE!**\n\nI'm your real-time AI co-pilot for the biggest sporting event on Earth.\n\nAsk me:\n📡  What's the score right now?\n🎟  Which matches still have tickets?\n🏨  Last-minute hotels near stadiums\n⚽  Group standings & knockout predictions\n🏆  Fantasy advice for today's matches\n\nWhat do you need?"
      : `⚽ **World Cup 2026 — ${daysToWC} days to kick-off!**\n\nI'm your AI travel and logistics agent for the 2026 FIFA World Cup across the USA, Canada, and Mexico.\n\nI can help you:\n✈  Plan your complete match trip (flights, hotels, itinerary)\n📋  Check visa & entry requirements for your passport\n🏨  Find hotels near all 16 stadiums\n🔔  Set flight price alerts — get notified when fares drop\n📊  View group standings & knockout bracket predictions\n🏆  Build your fantasy squad from 33 WC 2026 stars\n\nWhere are you flying from, and which match are you hoping to attend?`;

    setMessages([{
      id: "welcome",
      role: "agent",
      timestamp: new Date(),
      skillId: "SK-01",
      content: welcomeContent,
    }]);
  }, []);


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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 12px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Quick prompts — shown early in conversation */}
      {messages.length < 3 && (
        <div style={{ padding: "4px 20px 12px" }}>
          <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {getTopPrompts(userLocation).map((qp) => (
              <button key={qp.label} onClick={() => sendMessage(qp.prompt)} disabled={isLoading}
                style={{
                  padding: "7px 14px", borderRadius: 20,
                  border: "1px solid var(--border, #1a2d4a)",
                  background: "var(--surface, #0d1825)",
                  color: "var(--text2, #94a3b8)", fontSize: 12, cursor: "pointer",
                  fontFamily: "var(--font-sans)", fontWeight: 400,
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-border, #00c89630)";
                  (e.currentTarget as HTMLElement).style.background = "var(--accent-dim, #00c89618)";
                  (e.currentTarget as HTMLElement).style.color = "var(--accent, #00c896)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border, #1a2d4a)";
                  (e.currentTarget as HTMLElement).style.background = "var(--surface, #0d1825)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text2, #94a3b8)";
                }}
              >
                <span>{qp.icon}</span>
                <span>{qp.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{
        padding: "12px 20px 18px",
        borderTop: "1px solid var(--border, #1a2d4a)",
        background: "rgba(6,11,20,0.6)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{
            display: "flex", gap: 10, alignItems: "flex-end",
            background: "var(--surface, #0d1825)",
            border: `1px solid ${isLoading ? "var(--accent-border, #00c89630)" : "var(--border2, #243a55)"}`,
            borderRadius: 16, padding: "10px 10px 10px 16px",
            transition: "border-color 0.2s, box-shadow 0.2s",
            boxShadow: isLoading ? "0 0 0 3px var(--accent-dim, #00c89618)" : "none",
          }}>
            <textarea
              ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Ask anything… plan a trip, check visa, set a price alert…"
              disabled={isLoading} rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "var(--text, #f1f5f9)", fontSize: 14,
                fontFamily: "var(--font-sans)",
                resize: "none", maxHeight: 120, overflow: "auto", lineHeight: 1.6,
                paddingTop: 2,
              }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
            />
            <button
              onClick={() => sendMessage(input)} disabled={isLoading || !input.trim()}
              style={{
                width: 38, height: 38, borderRadius: 11, border: "none", fontSize: 16,
                background: isLoading || !input.trim()
                  ? "var(--border, #1a2d4a)"
                  : "linear-gradient(135deg, #00c896 0%, #0ea5e9 100%)",
                color: isLoading || !input.trim() ? "var(--text3)" : "#fff",
                cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.2s ease",
                boxShadow: isLoading || !input.trim() ? "none" : "0 0 14px var(--accent-glow, #00c89640)",
                fontWeight: 600,
              }}
            >
              {isLoading ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block", fontSize: 14 }}>⟳</span> : "↑"}
            </button>
          </div>
          <p style={{ textAlign: "center", margin: "8px 0 0", fontSize: 10, color: "var(--text4)", fontFamily: "var(--font-mono)" }}>
            Gemini 1.5 Pro · Tavily · Neon · Browserbase · Google Cloud
          </p>
        </div>
      </div>
    </div>
  );
}
