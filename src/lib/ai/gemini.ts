import { z } from "zod";
import { AIProviderError, parseStructured, type AIProvider, type StructuredRequest } from "./provider";

/** Google Gemini generateContent adapter (REST). */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  constructor(
    readonly model: string,
    private apiKey: string,
  ) {}

  async generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model,
    )}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: {
          maxOutputTokens: req.maxTokens ?? 16000,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(req.schema, { io: "input" }),
        },
      }),
    });
    if (!res.ok) {
      throw new AIProviderError(
        `Gemini API error ${res.status}: ${await res.text()}`,
        this.name,
        res.status === 429 || res.status >= 500,
      );
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    return parseStructured(text, req.schema, this.name);
  }
}
