import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AIProviderError } from "./ai";
import { UnauthorizedError } from "./auth";
import { HttpError } from "./errors";
import { FetchUrlError } from "./parse/fetch-url";

export { HttpError };

/** Wrap a route handler with consistent JSON error responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      // Let Next.js control-flow errors (prerender bailout, redirect, notFound) propagate.
      unstable_rethrow(err);
      if (err instanceof UnauthorizedError) return json({ error: err.message }, 401);
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      if (err instanceof ZodError) return json({ error: err.issues[0]?.message ?? "Invalid input" }, 400);
      if (err instanceof FetchUrlError) return json({ error: err.message }, 422);
      if (err instanceof AIProviderError) {
        console.error(`[ai:${err.provider}]`, err.message);
        return json({ error: "The AI service is temporarily unavailable. Please try again." }, 503);
      }
      console.error(err);
      const message = err instanceof Error && err.message ? err.message : "Something went wrong";
      return json({ error: process.env.NODE_ENV === "production" ? "Something went wrong" : message }, 500);
    }
  };
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
