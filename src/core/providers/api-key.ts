import type { Provider } from "../types.js";

export interface KeyConfig {
  label: string;
  url: string;
  headers: Record<string, string>;
  model: string;
  style: "anthropic" | "openai";
}

/** BYO key, in preference order. The fallback path — most people never hit it. */
export function detectApiKey(preferred?: string): KeyConfig | null {
  const env = process.env;

  const anthropic = (): KeyConfig | null =>
    env.ANTHROPIC_API_KEY
      ? {
          label: "Anthropic",
          url: "https://api.anthropic.com/v1/messages",
          headers: {
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          model: env.POPPR_MODEL ?? "claude-sonnet-4-5",
          style: "anthropic",
        }
      : null;

  const openai = (): KeyConfig | null =>
    env.OPENAI_API_KEY
      ? {
          label: "OpenAI",
          url: "https://api.openai.com/v1/chat/completions",
          headers: {
            authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "content-type": "application/json",
          },
          model: env.POPPR_MODEL ?? "gpt-4o",
          style: "openai",
        }
      : null;

  const openrouter = (): KeyConfig | null =>
    env.OPENROUTER_API_KEY
      ? {
          label: "OpenRouter",
          url: "https://openrouter.ai/api/v1/chat/completions",
          headers: {
            authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
            "content-type": "application/json",
          },
          model: env.POPPR_MODEL ?? "anthropic/claude-sonnet-4.5",
          style: "openai",
        }
      : null;

  // Local models are free, so they are worth supporting even though the quality
  // bar for good distractors is high.
  const ollama = (): KeyConfig | null =>
    env.OLLAMA_HOST
      ? {
          label: "Ollama (local)",
          url: `${env.OLLAMA_HOST.replace(/\/$/, "")}/v1/chat/completions`,
          headers: { "content-type": "application/json" },
          model: env.POPPR_MODEL ?? "qwen2.5-coder:14b",
          style: "openai",
        }
      : null;

  const byName: Record<string, () => KeyConfig | null> = {
    anthropic,
    openai,
    openrouter,
    ollama,
  };
  if (preferred && byName[preferred]) return byName[preferred]();

  return anthropic() ?? openai() ?? openrouter() ?? ollama();
}

export function apiKeyProvider(cfg: KeyConfig): Provider {
  return {
    name: cfg.label,
    async generate(prompt: string, opts): Promise<string> {
      const maxTokens = opts?.maxTokens ?? 8000;

      const body =
        cfg.style === "anthropic"
          ? { model: cfg.model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }
          : {
              model: cfg.model,
              max_tokens: maxTokens,
              messages: [{ role: "user", content: prompt }],
            };

      const res = await fetch(cfg.url, {
        method: "POST",
        headers: cfg.headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`${cfg.label} returned ${res.status}: ${await res.text()}`);
      }

      const json = (await res.json()) as Record<string, any>;
      const text =
        cfg.style === "anthropic"
          ? json.content?.[0]?.text
          : json.choices?.[0]?.message?.content;

      if (typeof text !== "string") {
        throw new Error(`Unexpected response shape from ${cfg.label}.`);
      }
      return text;
    },
  };
}
