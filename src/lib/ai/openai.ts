import { z } from "zod";
import { AIProviderError, parseStructured, type AIProvider, type StructuredRequest } from "./provider";

/** OpenAI Responses API adapter (REST — keeps the vendor SDK out of the bundle). */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  constructor(
    readonly model: string,
    private apiKey: string,
  ) {}

  async generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        instructions: req.system,
        input: req.prompt,
        max_output_tokens: req.maxTokens ?? 16000,
        text: {
          format: {
            type: "json_schema",
            name: req.schemaName,
            schema: z.toJSONSchema(req.schema, { io: "input" }),
            strict: false,
          },
        },
      }),
    });
    if (!res.ok) {
      throw new AIProviderError(
        `OpenAI API error ${res.status}: ${await res.text()}`,
        this.name,
        res.status === 429 || res.status >= 500,
      );
    }
    const data = (await res.json()) as {
      output?: { type: string; content?: { type: string; text?: string }[] }[];
    };
    const text = (data.output ?? [])
      .filter((o) => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text ?? "")
      .join("");
    return parseStructured(text, req.schema, this.name);
  }
}
