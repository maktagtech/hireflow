"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/client";
import { Logo } from "./app-shell";
import { LegalFooter } from "./legal-footer";
import { Alert, Button, Card, Input, Label } from "./ui";

function Frame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
          {children}
        </Card>
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
      <LegalFooter className="mt-10" />
    </div>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/auth/forgot-password", { method: "POST", json: Object.fromEntries(new FormData(e.currentTarget)) });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Frame title="Reset your password" subtitle="Enter your account email and we'll send you a reset link.">
      {sent ? (
        <Alert tone="success">
          If an account exists for that email, a reset link is on its way. It expires in one hour — check your spam folder
          if you don&apos;t see it.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={loading} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </Frame>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (form.get("password") !== form.get("confirm")) return setError("Passwords don't match");
    setError("");
    setLoading(true);
    try {
      await api("/api/auth/reset-password", { method: "POST", json: { token, password: form.get("password") } });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Frame title="Reset your password" subtitle="This page needs the link from your reset email.">
        <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
          Request a new reset link
        </Link>
      </Frame>
    );
  }

  return (
    <Frame title="Choose a new password" subtitle="You'll be signed out on all other devices.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        {error && (
          <Alert>
            {error}{" "}
            {/expired|invalid/i.test(error) && (
              <Link href="/forgot-password" className="font-medium underline">
                Request a new link
              </Link>
            )}
          </Alert>
        )}
        <Button type="submit" loading={loading} className="w-full">
          Set new password
        </Button>
      </form>
    </Frame>
  );
}
