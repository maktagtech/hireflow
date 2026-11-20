import Link from "next/link";
import { Logo } from "@/components/app-shell";
import { LegalFooter } from "@/components/legal-footer";

const STEPS = [
  { n: "1", title: "Upload your resume once", body: "PDF, DOCX or your LinkedIn PDF export. We turn it into a structured master profile." },
  { n: "2", title: "Paste a job link", body: "Or the description itself. We pull out the title, skills, requirements and ATS keywords." },
  { n: "3", title: "Click Optimize", body: "Get a tailored resume and cover letter as PDF and DOCX, with your ATS match score." },
];

const FEATURES = [
  { title: "ATS match score", body: "A transparent breakdown of skills, experience and keyword coverage — before and after tailoring." },
  { title: "Truthful by design", body: "Every rewrite is checked against your real experience. Skills you don't have are flagged as gaps, never invented." },
  { title: "Gap analysis", body: "See exactly which keywords a job wants that your resume is missing, so you know what to learn or add." },
  { title: "Interview-rate tracking", body: "Mark applications as applied, interviewing or offered. Measure what matters: interviews, not documents." },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-4">
        <Logo />
        <nav className="ml-auto flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-2 text-slate-600 hover:text-slate-900">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
            Get started
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-20 text-center">
          <p className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            Application intelligence
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
            Win more interviews.
            <br />
            <span className="text-brand-600">In 30 seconds per job.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Upload your master resume once. Paste any job URL. HireFlow generates a tailored, ATS-optimized resume and
            cover letter — truthfully — with a match score that shows exactly why it works.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup" className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700">
              Optimize my first application
            </Link>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50 py-16">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="mb-3 grid size-8 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                  {s.n}
                </div>
                <h3 className="font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-8 px-4 py-16 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-slate-600">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <LegalFooter className="border-t border-slate-100 py-6" />
    </div>
  );
}
