"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OptimizeBox } from "@/components/optimize-box";
import { StatusSelect } from "@/components/status-select";
import { Card, Spinner, scoreTone, cx } from "@/components/ui";
import { api } from "@/lib/client";
import type { ApplicationStatus } from "@/lib/types";

type App = {
  id: string;
  title: string;
  company: string;
  status: ApplicationStatus;
  createdAt: string;
  score: number | null;
  baseline: number | null;
};

type Stats = {
  generated: number;
  applications: number;
  interviews: number;
  offers: number;
  interviewRate: number | null;
  avgScore: number | null;
  avgLift: number | null;
};

export default function Dashboard() {
  const [apps, setApps] = useState<App[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  const refreshStats = useCallback(() => api<Stats>("/api/stats").then(setStats).catch(() => {}), []);

  useEffect(() => {
    api<{ applications: App[] }>("/api/applications").then((r) => setApps(r.applications)).catch(() => setApps([]));
    api<{ hasProfile: boolean }>("/api/me").then((r) => setHasProfile(r.hasProfile)).catch(() => {});
    refreshStats();
  }, [refreshStats]);

  return (
    <div className="space-y-8">
      {hasProfile === false && (
        <Card className="flex flex-col items-start justify-between gap-4 border-brand-100 bg-brand-50 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-brand-700">Step 1: upload your master resume</h2>
            <p className="text-sm text-brand-700/80">We need it once — then every job takes one click.</p>
          </div>
          <Link href="/profile" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Upload resume
          </Link>
        </Card>
      )}

      <OptimizeBox disabled={hasProfile === false} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your results</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Applications sent" value={stats?.applications ?? "–"} hint={stats ? `${stats.generated} package${stats.generated === 1 ? "" : "s"} generated` : undefined} />
          <Stat label="Interviews" value={stats?.interviews ?? "–"} hint={stats?.offers ? `${stats.offers} offer${stats.offers > 1 ? "s" : ""}` : undefined} />
          <Stat
            label="Interview rate"
            value={stats?.interviewRate != null ? `${stats.interviewRate}%` : "–"}
            hint="The metric that matters"
            highlight
          />
          <Stat
            label="Avg. ATS match"
            value={stats?.avgScore != null ? `${stats.avgScore}%` : "–"}
            hint={stats?.avgLift ? `+${stats.avgLift} pts from tailoring` : undefined}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Applications</h2>
        <Card className="overflow-hidden">
          {apps === null ? (
            <div className="flex justify-center p-10 text-slate-400">
              <Spinner />
            </div>
          ) : apps.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">
              No applications yet. Paste a job above to generate your first tailored resume.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {apps.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-slate-50">
                  <Link href={`/applications/${a.id}`} className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900">{a.title || "Untitled role"}</div>
                    <div className="truncate text-sm text-slate-500">
                      {a.company || "Unknown company"} · {new Date(a.createdAt).toLocaleDateString()}
                    </div>
                  </Link>
                  {a.score !== null && (
                    <div className="text-right text-sm tabular-nums">
                      <span className={cx("text-lg font-semibold", scoreTone(a.score))}>{a.score}%</span>
                      {a.baseline !== null && a.baseline !== a.score && (
                        <div className="text-xs text-slate-400">from {a.baseline}%</div>
                      )}
                    </div>
                  )}
                  <StatusSelect id={a.id} value={a.status} onChange={refreshStats} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value, hint, highlight }: { label: string; value: string | number; hint?: string; highlight?: boolean }) {
  return (
    <Card className={cx("p-5", highlight && "border-brand-100 ring-1 ring-brand-100")}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className={cx("mt-1 text-3xl font-semibold tabular-nums", highlight && "text-brand-600")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </Card>
  );
}
