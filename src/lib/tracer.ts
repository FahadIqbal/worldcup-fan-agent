// src/lib/tracer.ts
// Shared OpenTelemetry tracer + OpenInference attribute helpers.
// The tracer is obtained lazily — it resolves to the no-op tracer until
// Phoenix registration runs in instrumentation.ts, then auto-upgrades.

import { trace, SpanStatusCode } from "@arizeai/phoenix-otel";
import {
  SemanticAttributePrefixes as P,
  LLMAttributePostfixes as LLM,
} from "@arizeai/openinference-semantic-conventions";

// ─── Tracer ────────────────────────────────────────────────────────────────

export const tracer = trace.getTracer("worldcup-fan-agent", "1.0.0");

// ─── Attribute key constants (OpenInference semantic conventions) ──────────

export const A = {
  // Span kind — value is one of AGENT | CHAIN | LLM | TOOL | RETRIEVER
  SPAN_KIND: "openinference.span.kind",

  // LLM span
  LLM_MODEL: `${P.llm}.${LLM.model_name}`,
  LLM_INPUT: `${P.input}.value`,
  LLM_OUTPUT: `${P.output}.value`,
  LLM_TOKENS_TOTAL: `${P.llm}.${LLM.token_count}.total`,
  LLM_TOKENS_PROMPT: `${P.llm}.${LLM.token_count}.prompt`,
  LLM_TOKENS_COMPLETION: `${P.llm}.${LLM.token_count}.completion`,
  LLM_SYSTEM: `${P.llm}.system`,

  // Tool span
  TOOL_NAME: `${P.tool}.name`,
  TOOL_INPUT: `${P.input}.value`,
  TOOL_OUTPUT: `${P.output}.value`,

  // Session / user (for Phoenix trace grouping)
  SESSION_ID: `${P.session}.id`,
  USER_ID: `${P.user}.id`,

  // Custom metadata
  SKILL_ID: `${P.metadata}.skill_id`,
  SKILL_NAME: `${P.metadata}.skill_name`,
} as const;

export { SpanStatusCode };
