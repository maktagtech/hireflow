import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { AIProviderError, parseStructured, type AIProvider, type StructuredRequest } from "./provider";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(readonly model: string) {
    this.client = new Anthropic();
  }

  async generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
    try {
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 16000,
        // Re-route policy declines to a suitable model instead of failing the request.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {
          effort: "medium",
          format: zodOutputFormat(req.schema as never),
        },
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.prompt }],
      });

      if (response.stop_reason === "refusal") {
        throw new AIProviderError("The model declined this request", this.name);
      }
      if (response.stop_reason === "max_tokens") {
        throw new AIProviderError("Model output was truncated", this.name, true);
      }
      const text = response.content
        .flatMap((b) => (b.type === "text" ? [b.text] : []))
        .join("");
      return parseStructured(text, req.schema, this.name);
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError) {
        throw new AIProviderError(err.message, this.name, true);
      }
      if (err instanceof Anthropic.APIError) {
        throw new AIProviderError(`Anthropic API error ${err.status}: ${err.message}`, this.name);
      }
      throw err;
    }
  }
}
