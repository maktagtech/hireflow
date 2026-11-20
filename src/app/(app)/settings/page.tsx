"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { api } from "@/lib/client";

type Status = { tone: "error" | "success"; text: string } | null;

export default function SettingsPage() {
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    api<{ user: { name: string; email: string } }>("/api/me")
      .then((r) => setMe(r.user))
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        {me && (
          <p className="text-sm text-slate-500">
            Signed in as {me.name ? `${me.name} · ` : ""}
            {me.email}
          </p>
        )}
      </div>
      <ChangePassword />
      <ExportData />
      <DeleteAccount />
    </div>
  );
}

function Section({ title, description, children, danger }: { title: string; description: ReactNode; children: ReactNode; danger?: boolean }) {
  return (
    <Card className={danger ? "border-red-200 p-6" : "p-6"}>
      <h2 className={danger ? "font-semibold text-red-700" : "font-semibold"}>{title}</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">{description}</p>
      {children}
    </Card>
  );
}

function ChangePassword() {
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    if (form.get("newPassword") !== form.get("confirm")) return setStatus({ tone: "error", text: "New passwords don't match" });
    setStatus(null);
    setLoading(true);
    try {
      await api("/api/account/password", {
        method: "POST",
        json: { currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") },
      });
      formEl.reset();
      setStatus({ tone: "success", text: "Password updated. You've been signed out on all other devices." });
    } catch (err) {
      setStatus({ tone: "error", text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="Change password" description="Changing your password signs you out everywhere else.">
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label htmlFor="currentPassword">Current password</Label>
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </div>
        </div>
        {status && <Alert tone={status.tone}>{status.text}</Alert>}
        <Button type="submit" loading={loading}>
          Update password
        </Button>
      </form>
    </Section>
  );
}

function ExportData() {
  return (
    <Section
      title="Download your data"
      description="A JSON file with your account details, master profile, every job you've added and every resume and cover letter we generated."
    >
      <a
        href="/api/account/export"
        className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        Download my data
      </a>
    </Section>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/account", {
        method: "DELETE",
        json: { password: new FormData(e.currentTarget).get("password"), confirm },
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Section
      danger
      title="Delete account"
      description={
        <>
          Permanently deletes your account, master profile, uploaded resumes, job history and all generated documents.
          This can&apos;t be undone — consider <a href="/api/account/export" className="underline">downloading your data</a> first.
        </>
      }
    >
      {!open ? (
        <Button variant="secondary" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => setOpen(true)}>
          Delete my account…
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="delete-password">Your password</Label>
            <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <div>
            <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
            <Input id="delete-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-2">
            <Button
              type="submit"
              loading={loading}
              disabled={confirm !== "DELETE"}
              className="bg-red-600 hover:bg-red-700"
            >
              Permanently delete account
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}
