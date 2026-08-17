import type { Provider } from "../types.js";
import { claudeCodeProvider } from "./claude-code.js";
import { cursorAgentProvider } from "./cursor-agent.js";
import { apiKeyProvider, detectApiKey } from "./api-key.js";
import { resolveBin } from "./spawn.js";

export interface ProviderChoice {
  provider: Provider;
  /** Shown to the user so they know whose tokens are being spent. */
  note: string;
}

/**
 * The whole economic model of poppr lives here: we never ship inference, we
 * borrow compute the user already pays for. Order matters — the first two cost
 * the user nothing beyond a subscription they already have.
 */
export async function detectProvider(preferred?: string): Promise<ProviderChoice> {
  const candidates: Array<() => Promise<ProviderChoice | null>> = [
    async () => {
      if (preferred && preferred !== "claude-code") return null;
      const resolved = await resolveBin("claude");
      return resolved
        ? {
            provider: claudeCodeProvider("claude", resolved),
            note: "Claude Code (your existing subscription)",
          }
        : null;
    },
    async () => {
      if (preferred && preferred !== "cursor-agent") return null;
      const resolved = await resolveBin("cursor-agent");
      return resolved
        ? {
            provider: cursorAgentProvider("cursor-agent", resolved),
            note: "Cursor Agent (your existing subscription)",
          }
        : null;
    },
    async () => {
      if (preferred && !["api", "anthropic", "openai", "openrouter", "ollama"].includes(preferred)) {
        return null;
      }
      const key = detectApiKey(preferred);
      return key ? { provider: apiKeyProvider(key), note: `${key.label} (your API key)` } : null;
    },
  ];

  for (const c of candidates) {
    const hit = await c();
    if (hit) return hit;
  }

  throw new Error(
    [
      "No AI backend found. PopPR runs on compute you already have. Pick one:",
      "",
      "  1. Install Claude Code       → npm i -g @anthropic-ai/claude-code   (recommended)",
      "  2. Install the Cursor agent  → cursor-agent on your PATH",
      "  3. Export an API key         → ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY",
      "  4. Run a local model         → OLLAMA_HOST=http://localhost:11434",
    ].join("\n"),
  );
}

export type { Provider };
