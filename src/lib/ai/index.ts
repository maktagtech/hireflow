import "server-only";
import type { z } from "zod";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import { AIProviderError, type AIProvider, type StructuredRequest } from "./provider";

export { AIProviderError } from "./provider";
export type { AIProvider } from "./provider";

const DEFAULT_MODELS = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5",
  gemini: "gemini-2.5-pro",
} as const;

type ProviderName = keyof typeof DEFAULT_MODELS;

function build(name: ProviderName): AIProvider | null {
  const model = process.env.AI_MODEL || DEFAULT_MODELS[name];
  switch (name) {
    case "anthropic":
      // The SDK also resolves ANTHROPIC_AUTH_TOKEN / `ant auth login` profiles,
      // so only an explicit AI_PROVIDER=anthropic or an API key opts in.
      return process.env.ANTHROPIC_API_KEY || process.env.AI_PROVIDER === "anthropic"
        ? new AnthropicProvider(model)
        : null;
    case "openai":
      return process.env.OPENAI_API_KEY ? new OpenAIProvider(model, process.env.OPENAI_API_KEY) : null;
    case "gemini":
      return process.env.GEMINI_API_KEY ? new GeminiProvider(model, process.env.GEMINI_API_KEY) : null;
  }
}

let cached: AIProvider | null | undefined;

/**
 * Returns the configured provider, or null when none is configured — callers
 * then use the deterministic offline engine so the product still works.
 *
 * Selection: AI_PROVIDER if set ("anthropic" | "openai" | "gemini" | "offline"),
 * otherwise the first provider with credentials in the order above.
 */
export function getAI(): AIProvider | null {
  if (cached !== undefined) return cached;
  const requested = process.env.AI_PROVIDER?.toLowerCase();
  if (requested === "offline") return (cached = null);
  if (requested && requested in DEFAULT_MODELS) {
    cached = build(requested as ProviderName);
    if (!cached) throw new Error(`AI_PROVIDER=${requested} but its API key is not set`);
    return cached;
  }
  for (const name of Object.keys(DEFAULT_MODELS) as ProviderName[]) {
    const p = build(name);
    if (p) return (cached = p);
  }
  return (cached = null);
}

/** Structured generation with one retry for transient/validation failures. */
export async function generate<T extends z.ZodType>(
  ai: AIProvider,
  req: StructuredRequest<T>,
): Promise<z.infer<T>> {
  try {
    return await ai.generateStructured(req);
  } catch (err) {
    if (err instanceof AIProviderError && err.retryable) {
      return ai.generateStructured(req);
    }
    throw err;
  }
}
