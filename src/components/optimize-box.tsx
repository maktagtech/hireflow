"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { Alert, Button, Card, Input, Textarea, cx } from "./ui";

const STAGES = [
  "Reading the job description",
  "Matching your skills",
  "Tailoring your resume",
  "Writing your cover letter",
  "Generating PDF & DOCX",
];

export function OptimizeBox({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);

  // Progress is indicative: the server runs these steps in one request.
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2500);
    return () => clearInterval(t);
  }, [loading]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setStage(0);
    setLoading(true);
    try {
      const res = await api<{ applicationId: string }>("/api/optimize", {
        method: "POST",
        json: mode === "url" ? { url } : { text },
      });
      router.push(`/applications/${res.applicationId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      // Sites that block scraping: steer the user to paste instead.
      if (mode === "url" && /paste/i.test(message)) setMode("text");
      setLoading(false);
    }
  }

  const ready = mode === "url" ? /^https?:\/\/\S+\.\S+/.test(url.trim()) : text.trim().length >= 100;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Optimize for a job</h2>
          <p className="text-sm text-slate-500">Tailored resume + cover letter + ATS score in one click.</p>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-1 text-sm" role="tablist">
          {(["url", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cx("rounded-md px-3 py-1", mode === m ? "bg-white font-medium shadow-sm" : "text-slate-600")}
            >
              {m === "url" ? "Job URL" : "Paste description"}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "url" ? (
          <Input
            type="url"
            placeholder="https://boards.greenhouse.io/company/jobs/123456"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading || disabled}
            aria-label="Job URL"
          />
        ) : (
          <Textarea
            rows={8}
            placeholder="Paste the full job description here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading || disabled}
            aria-label="Job description"
          />
        )}
        {error && <Alert>{error}</Alert>}
        <div className="flex items-center gap-4">
          <Button type="submit" size="lg" loading={loading} disabled={!ready || disabled}>
            {loading ? "Optimizing…" : "Optimize"}
          </Button>
          {loading && (
            <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-live="polite">
              {STAGES.map((s, i) => (
                <li key={s} className={cx(i < stage ? "text-emerald-600" : i === stage ? "font-medium text-slate-900" : "text-slate-400")}>
                  {i < stage ? "✓ " : ""}
                  {s}
                </li>
              ))}
            </ol>
          )}
        </div>
      </form>
    </Card>
  );
}
