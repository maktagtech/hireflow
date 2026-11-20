import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CoverLetterSchema, JobSchema, ProfileSchema, TailoringSchema } from "@/lib/types";
import { parseStructured } from "@/lib/ai/provider";

const schemas = { ProfileSchema, JobSchema, TailoringSchema, CoverLetterSchema };

describe("AI structured-output schemas", () => {
  it.each(Object.entries(schemas))("%s converts for every provider", (_name, schema) => {
    expect(() => zodOutputFormat(schema as never)).not.toThrow();
    expect(z.toJSONSchema(schema, { io: "input" })).toHaveProperty("type", "object");
  });

  it("validates and defaults partial model output", () => {
    const job = parseStructured('```json\n{"title":"SWE","skills":["Go"]}\n```', JobSchema, "test");
    expect(job).toMatchObject({ title: "SWE", skills: ["Go"], alternatives: [], minYearsExperience: null });
    expect(() => parseStructured("not json", JobSchema, "test")).toThrow(/invalid JSON/);
  });
});
