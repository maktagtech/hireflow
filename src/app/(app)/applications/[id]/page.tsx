"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusSelect } from "@/components/status-select";
import { Alert, Badge, Bar, Button, Card, ScoreRing, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/client";
import type { ApplicationStatus, AtsScore, CoverLetter, Job, Profile, Tailoring } from "@/lib/types";

type Detail = {
  job: { id: string; title: string; company: string; url: string | null; status: ApplicationStatus; createdAt: string; parsed: Job };
  result: {
    version: number;
    score: AtsScore;
    baseline: AtsScore;
    tailoring: Tailoring;
    resume: Profile;
    coverLetter: CoverLetter;
    aiProvider: string;
  } | null;
};

const DOWNLOADS = [
  { file: "resume.pdf", label: "Resume", fmt: "PDF" },
  { file: "resume.docx", label: "Resume", fmt: "DOCX" },
  { file: "cover-letter.pdf", label: "Cover letter", fmt: "PDF" },
  { file: "cover-letter.docx", label: "Cover letter", fmt: "DOCX" },
];

export default function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"changes" | "resume" | "letter">("changes");

  useEffect(() => {
    api<Detail>(`/api/applications/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [id]);

  async function remove() {
    if (!confirm("Delete this application and its generated documents?")) return;
    await api(`/api/applications/${id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  if (error) return <Alert>{error}</Alert>;
  if (!data) {
    return (
      <div className="flex justify-center p-20 text-slate-400">
        <Spinner />
      </div>
    );
  }

  const { job, result } = data;
  if (!result) return <Alert>No generated documents for this application.</Alert>;
  const { score, baseline } = result;
  const lift = score.overall - baseline.overall;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{job.title || "Untitled role"}</h1>
          <p className="text-slate-500">
            {[job.company, job.parsed.location].filter(Boolean).join(" · ")}
            {job.url && (
              <>
                {" · "}
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                  View posting
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusSelect id={job.id} value={job.status} />
          <Button variant="ghost" size="sm" onClick={remove}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center gap-3 p-6">
          <ScoreRing value={score.overall} size={148} label="ATS match" />
          {lift > 0 ? (
            <Badge tone="green">+{lift} pts vs. your master resume ({baseline.overall}%)</Badge>
          ) : (
            <Badge>Master resume already scored {baseline.overall}%</Badge>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="font-semibold">Score breakdown</h2>
          <Bar label="Skills" value={score.skills} before={baseline.skills} />
          <Bar label="Experience" value={score.experience} before={baseline.experience} />
          <Bar label="Keywords" value={score.keywords} before={baseline.keywords} />
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 font-semibold">Download your application</h2>
          <div className="grid grid-cols-2 gap-2">
            {DOWNLOADS.map((d) => (
              <a
                key={d.file}
                href={`/api/applications/${job.id}/download/${d.file}`}
                className="flex flex-col rounded-lg border border-slate-200 px-3 py-2.5 text-sm hover:border-brand-500 hover:bg-brand-50"
              >
                <span className="font-medium">{d.label}</span>
                <span className="text-xs text-slate-500">{d.fmt} ↓</span>
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">Single-column ATS format · no tables or graphics</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold">Skill gaps</h2>
          <p className="mb-3 text-xs text-slate-500">
            Skills the job asks for that aren&apos;t in your profile. We never add these for you — if you have them, add
            them to your master profile and re-run.
          </p>
          {score.missingSkills.length ? (
            <div className="flex flex-wrap gap-1.5">
              {score.missingSkills.map((s) => (
                <Badge key={s} tone="red">{s}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-600">You match every required skill.</p>
          )}
          {score.matchedSkills.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Matched</h3>
              <div className="flex flex-wrap gap-1.5">
                {score.matchedSkills.map((s) => (
                  <Badge key={s} tone="green">{s}</Badge>
                ))}
              </div>
            </>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold">Keywords</h2>
          <p className="mb-3 text-xs text-slate-500">Other terms ATS systems scan for in this posting.</p>
          <div className="flex flex-wrap gap-1.5">
            {score.matchedKeywords.map((k) => (
              <Badge key={k} tone="green">{k}</Badge>
            ))}
            {score.missingKeywords.map((k) => (
              <Badge key={k} tone="amber">{k}</Badge>
            ))}
            {!score.matchedKeywords.length && !score.missingKeywords.length && (
              <p className="text-sm text-slate-400">No additional keywords detected.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex gap-1 border-b border-slate-200 px-4 pt-3" role="tablist">
          {([
            ["changes", `What we changed (${result.tailoring.rewrites.length})`],
            ["resume", "Tailored resume"],
            ["letter", "Cover letter"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cx(
                "-mb-px border-b-2 px-3 pb-2 text-sm",
                tab === key ? "border-brand-600 font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-6">
          {tab === "changes" && <Changes result={result} />}
          {tab === "resume" && <ResumePreview p={result.resume} />}
          {tab === "letter" && <LetterPreview letter={result.coverLetter} name={result.resume.name} />}
        </div>
      </Card>
      <p className="text-right text-xs text-slate-400">Engine: {result.aiProvider}</p>
    </div>
  );
}

function Changes({ result }: { result: NonNullable<Detail["result"]> }) {
  const { tailoring, resume } = result;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-sm font-medium">Summary</h3>
        <p className="text-sm text-slate-700">{tailoring.summary}</p>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-medium">Skills order</h3>
        <p className="text-sm text-slate-700">Job-relevant skills moved to the front: {resume.skills.slice(0, 8).join(", ")}</p>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Rewritten bullets</h3>
        {tailoring.rewrites.length === 0 ? (
          <p className="text-sm text-slate-500">Your bullets already read well for this role, so we only reordered them by relevance.</p>
        ) : (
          <ul className="space-y-3">
            {tailoring.rewrites.map((r, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="text-slate-400 line-through decoration-slate-300">{r.original}</div>
                <div className="mt-1 text-slate-900">{r.rewritten}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResumePreview({ p }: { p: Profile }) {
  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 font-[Calibri,Arial,sans-serif] text-[13px] leading-relaxed text-slate-900 shadow-sm">
      <div className="text-center">
        <div className="text-2xl font-bold">{p.name}</div>
        <div className="text-xs text-slate-600">{[p.email, p.phone, p.location, ...p.links].filter(Boolean).join("  |  ")}</div>
        {p.headline && <div className="mt-1 italic">{p.headline}</div>}
      </div>
      {p.summary && <ResumeSection title="Professional Summary"><p>{p.summary}</p></ResumeSection>}
      {p.skills.length > 0 && <ResumeSection title="Skills"><p>{p.skills.join(", ")}</p></ResumeSection>}
      {p.experience.length > 0 && (
        <ResumeSection title="Professional Experience">
          {p.experience.map((e, i) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between gap-4 font-semibold">
                <span>{[e.title, e.company].filter(Boolean).join(", ")}</span>
                <span className="shrink-0 font-normal">{[e.startDate, e.endDate].filter(Boolean).join(" – ")}</span>
              </div>
              <ul className="ml-5 list-disc">
                {e.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </ResumeSection>
      )}
      {p.projects.length > 0 && (
        <ResumeSection title="Projects">
          {p.projects.map((pr, i) => (
            <div key={i} className="mb-2">
              <span className="font-semibold">{pr.name}</span>
              {pr.description && <span> — {pr.description}</span>}
            </div>
          ))}
        </ResumeSection>
      )}
      {p.education.length > 0 && (
        <ResumeSection title="Education">
          {p.education.map((e, i) => (
            <div key={i} className="flex justify-between gap-4">
              <span>{[[e.degree, e.field].filter(Boolean).join(", "), e.institution].filter(Boolean).join(", ")}</span>
              <span className="shrink-0">{e.endDate}</span>
            </div>
          ))}
        </ResumeSection>
      )}
      {p.certifications.length > 0 && (
        <ResumeSection title="Certifications">
          <ul className="ml-5 list-disc">{p.certifications.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </ResumeSection>
      )}
    </div>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1 border-b border-slate-400 text-sm font-bold uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  );
}

function LetterPreview({ letter, name }: { letter: CoverLetter; name: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-lg border border-slate-200 bg-white p-8 text-sm leading-relaxed shadow-sm">
      <p>{letter.greeting}</p>
      {letter.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <p>
        {letter.closing}
        <br />
        {name}
      </p>
    </div>
  );
}
