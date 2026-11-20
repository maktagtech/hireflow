import type { z } from "zod";

export type StructuredRequest<T extends z.ZodType> = {
  /** Stable instructions — kept first so providers can cache them. */
  system: string;
  /** Per-request content (resume text, job description, ...). */
  prompt: string;
  schema: T;
  /** Short identifier used by providers that require a schema name. */
  schemaName: string;
  maxTokens?: number;
};

/**
 * The only surface the app uses to talk to an LLM. Adapters translate this
 * into each vendor's API; callers never import a vendor SDK directly.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

/** Parse a model's JSON text output and validate it against the schema. */
export function parseStructured<T extends z.ZodType>(
  text: string,
  schema: T,
  provider: string,
): z.infer<T> {
  // Tolerate a stray markdown fence even though we request raw JSON.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new AIProviderError("Model returned invalid JSON", provider, true);
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new AIProviderError(
      `Model output failed validation: ${result.error.issues[0]?.message ?? "unknown"}`,
      provider,
      true,
    );
  }
  return result.data;
}
