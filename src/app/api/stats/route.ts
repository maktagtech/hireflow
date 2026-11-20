import { handler, json } from "@/lib/api";
import { listApplications } from "@/lib/applications";
import { requireUser } from "@/lib/auth";

/**
 * The metric that matters: interview rate = applications that reached an
 * interview (or offer) ÷ applications actually sent.
 */
export const GET = handler(async () => {
  const user = await requireUser();
  const apps = await listApplications(user.id);
  const applied = apps.filter((a) => a.status !== "generated").length;
  const interviews = apps.filter((a) => a.status === "interview" || a.status === "offer").length;
  const scored = apps.filter((a) => a.score !== null);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  return json({
    generated: apps.length,
    applications: applied,
    interviews,
    offers: apps.filter((a) => a.status === "offer").length,
    interviewRate: applied ? Math.round((interviews / applied) * 1000) / 10 : null,
    avgScore: avg(scored.map((a) => a.score!)),
    avgLift: avg(scored.map((a) => a.score! - (a.baseline ?? a.score!))),
  });
});
