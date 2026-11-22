"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Alert, Button, Card, Input, Label, Spinner, Textarea, cx } from "@/components/ui";
import { api } from "@/lib/client";
import type { Profile } from "@/lib/types";

type Experience = Profile["experience"][number];
type Education = Profile["education"][number];
type Project = Profile["projects"][number];

const EMPTY: Profile = {
  name: "", email: "", phone: "", location: "", links: [], headline: "", summary: "",
  skills: [], experience: [], education: [], projects: [], certifications: [], achievements: [],
};
const newExperience = (): Experience => ({ title: "", company: "", location: "", startDate: "", endDate: "", bullets: [] });
const newEducation = (): Education => ({ institution: "", degree: "", field: "", startDate: "", endDate: "", details: [] });
const newProject = (): Project => ({ name: "", description: "", technologies: [], bullets: [], link: "" });

const lines = (s: string) => s.split("\n");
const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ profile: Profile | null }>("/api/profile")
      .then((r) => setProfile(r.profile))
      .finally(() => setLoaded(true));
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const r = await api<{ profile: Profile; parsedBy: string }>("/api/profile/upload", { method: "POST", body });
      setProfile(r.profile);
      setMessage({ tone: "success", text: "Resume imported. Review the details below, then save any corrections." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload: Profile = {
        ...profile,
        links: clean(profile.links),
        skills: clean(profile.skills),
        certifications: clean(profile.certifications),
        achievements: clean(profile.achievements),
        experience: profile.experience.map((e) => ({ ...e, bullets: clean(e.bullets) })),
        education: profile.education.map((e) => ({ ...e, details: clean(e.details) })),
        projects: profile.projects.map((p) => ({ ...p, bullets: clean(p.bullets), technologies: clean(p.technologies) })),
      };
      const r = await api<{ profile: Profile }>("/api/profile", { method: "PUT", json: payload });
      setProfile(r.profile);
      setMessage({ tone: "success", text: "Profile saved." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) upload(f);
  }

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((p) => ({ ...(p ?? EMPTY), [key]: value }));

  if (!loaded) {
    return (
      <div className="flex justify-center p-20 text-slate-400">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Master profile</h1>
          <p className="text-sm text-slate-500">
            Your complete career history. Every tailored resume is built only from what&apos;s here.
          </p>
        </div>
        {profile && (
          <div className="flex gap-2">
            <Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg px-4 text-sm text-slate-600 hover:bg-slate-100">
              Go to dashboard
            </Link>
            <Button onClick={save} loading={saving}>
              Save profile
            </Button>
          </div>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white",
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3 text-slate-600">
            <Spinner className="size-6 text-brand-600" />
            Reading your resume…
          </div>
        ) : (
          <>
            <p className="font-medium text-slate-900">{profile ? "Replace with a new resume" : "Upload your master resume"}</p>
            <p className="mt-1 text-sm text-slate-500">PDF, DOCX or LinkedIn PDF export · up to 4 MB</p>
            <Button variant={profile ? "secondary" : "primary"} className="mt-4" onClick={() => fileRef.current?.click()}>
              Choose file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            {!profile && (
              <p className="mt-4 text-xs text-slate-400">
                No resume handy?{" "}
                <button className="underline" onClick={() => setProfile(EMPTY)}>
                  Enter your details manually
                </button>
              </p>
            )}
          </>
        )}
      </div>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {profile && (
        <>
          <Section title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" value={profile.name} onChange={(v) => set("name", v)} />
              <Field label="Headline" value={profile.headline} onChange={(v) => set("headline", v)} placeholder="e.g. Backend Software Engineer" />
              <Field label="Email" value={profile.email} onChange={(v) => set("email", v)} />
              <Field label="Phone" value={profile.phone} onChange={(v) => set("phone", v)} />
              <Field label="Location" value={profile.location} onChange={(v) => set("location", v)} />
              <Field label="Links (comma separated)" value={profile.links.join(", ")} onChange={(v) => set("links", v.split(/,\s*/))} />
            </div>
            <div className="mt-4">
              <Label>Summary</Label>
              <Textarea rows={3} value={profile.summary} onChange={(e) => set("summary", e.target.value)} />
            </div>
          </Section>

          <Section title="Skills" hint="Comma separated. Include everything you've genuinely used — tailoring picks the relevant ones.">
            <Textarea rows={3} value={profile.skills.join(", ")} onChange={(e) => set("skills", e.target.value.split(/,\s*/))} />
          </Section>

          <Section
            title="Experience"
            action={<Button variant="secondary" size="sm" onClick={() => set("experience", [newExperience(), ...profile.experience])}>Add role</Button>}
          >
            <ListEditor
              items={profile.experience}
              onChange={(v) => set("experience", v)}
              render={(e, update) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Title" value={e.title} onChange={(v) => update({ title: v })} />
                    <Field label="Company" value={e.company} onChange={(v) => update({ company: v })} />
                    <Field label="Start" value={e.startDate} onChange={(v) => update({ startDate: v })} placeholder="Jan 2021" />
                    <Field label="End" value={e.endDate} onChange={(v) => update({ endDate: v })} placeholder="Present" />
                  </div>
                  <div className="mt-3">
                    <Label>Achievements & responsibilities (one per line)</Label>
                    <Textarea rows={Math.max(3, e.bullets.length + 1)} value={e.bullets.join("\n")} onChange={(ev) => update({ bullets: lines(ev.target.value) })} />
                  </div>
                </>
              )}
            />
          </Section>

          <Section
            title="Education"
            action={<Button variant="secondary" size="sm" onClick={() => set("education", [...profile.education, newEducation()])}>Add education</Button>}
          >
            <ListEditor
              items={profile.education}
              onChange={(v) => set("education", v)}
              render={(e, update) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Institution" value={e.institution} onChange={(v) => update({ institution: v })} />
                  <Field label="Degree" value={e.degree} onChange={(v) => update({ degree: v })} />
                  <Field label="Field of study" value={e.field} onChange={(v) => update({ field: v })} />
                  <Field label="End / graduation" value={e.endDate} onChange={(v) => update({ endDate: v })} />
                </div>
              )}
            />
          </Section>

          <Section
            title="Projects"
            action={<Button variant="secondary" size="sm" onClick={() => set("projects", [...profile.projects, newProject()])}>Add project</Button>}
          >
            <ListEditor
              items={profile.projects}
              onChange={(v) => set("projects", v)}
              render={(p, update) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name" value={p.name} onChange={(v) => update({ name: v })} />
                    <Field label="Technologies (comma separated)" value={p.technologies.join(", ")} onChange={(v) => update({ technologies: v.split(/,\s*/) })} />
                  </div>
                  <div className="mt-3">
                    <Label>Description</Label>
                    <Textarea rows={2} value={p.description} onChange={(e) => update({ description: e.target.value })} />
                  </div>
                </>
              )}
            />
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Certifications" hint="One per line">
              <Textarea rows={4} value={profile.certifications.join("\n")} onChange={(e) => set("certifications", lines(e.target.value))} />
            </Section>
            <Section title="Achievements & awards" hint="One per line">
              <Textarea rows={4} value={profile.achievements.join("\n")} onChange={(e) => set("achievements", lines(e.target.value))} />
            </Section>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} loading={saving} size="lg">
              Save profile
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ListEditor<T>({
  items,
  onChange,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}) {
  if (items.length === 0) return <p className="text-sm text-slate-400">Nothing added yet.</p>;
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-4">
          {render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}
          <div className="mt-3 flex justify-end">
            <Button variant="danger" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
