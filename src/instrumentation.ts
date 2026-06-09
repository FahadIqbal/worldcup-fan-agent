// src/instrumentation.ts
// Next.js auto-loads this file on server startup (requires instrumentationHook: true in next.config.js).
// This is the entry point for Arize Phoenix OpenTelemetry tracing.
// Docs: https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/javascript

export async function register() {
  // Only run in the Node.js runtime — skip during edge/middleware execution
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const apiKey = process.env.PHOENIX_API_KEY;
  const collectorUrl =
    process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "https://app.phoenix.arize.com";
  const projectName = process.env.PHOENIX_PROJECT ?? "worldcup-fan-agent";

  if (!apiKey) {
    // Phoenix key not set — tracing silently disabled (no-op provider is used)
    return;
  }

  // Dynamic import keeps this off the critical path for the edge runtime
  const { register: phoenixRegister } = await import("@arizeai/phoenix-otel");

  phoenixRegister({
    projectName,
    url: collectorUrl,
    apiKey,
    batch: true, // BatchSpanProcessor — recommended for production Cloud Run
  });

  console.log(
    `[Phoenix] Tracing active → project="${projectName}" collector="${collectorUrl}"`
  );
}
