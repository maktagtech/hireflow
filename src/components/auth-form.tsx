"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { Logo } from "./app-shell";
import { LegalFooter } from "./legal-footer";
import { Alert, Button, Card, Input, Label } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteOnly, setInviteOnly] = useState(false);
  const inviteFromLink = params.get("invite") ?? "";
  const emailFromLink = params.get("email") ?? "";
  const signup = mode === "signup";

  useEffect(() => {
    if (!signup) return;
    api<{ inviteOnly: boolean }>("/api/auth/signup")
      .then((r) => setInviteOnly(r.inviteOnly))
      .catch(() => {});
  }, [signup]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(form);
    if (signup) body.acceptTerms = form.get("acceptTerms") === "on";
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: body });
      const next = params.get("next");
      // Only allow same-site relative redirects.
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : signup ? "/profile" : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const showInvite = signup && (inviteOnly || !!inviteFromLink);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">
            {signup
              ? inviteOnly
                ? "HireFlow is in private beta. Use the invite code you received."
                : "Upload your resume once, tailor it to every job."
              : "Sign in to continue your job search."}
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            {signup && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" name="name" autoComplete="name" required />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" defaultValue={emailFromLink} required />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <Label htmlFor="password">Password</Label>
                {!signup && (
                  <Link href="/forgot-password" className="text-xs text-brand-600 hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 8 : undefined}
                required
              />
            </div>
            {showInvite && (
              <div>
                <Label htmlFor="inviteCode">Invite code</Label>
                <Input
                  id="inviteCode"
                  name="inviteCode"
                  defaultValue={inviteFromLink}
                  placeholder="HF-XXXX-XXXX"
                  autoComplete="off"
                  required={inviteOnly}
                  className="font-mono uppercase"
                />
              </div>
            )}
            {signup && (
              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-4 accent-brand-600" />
                <span>
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" className="text-brand-600 hover:underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" className="text-brand-600 hover:underline">
                    Privacy Policy
                  </Link>
                  , including processing my resume with AI providers.
                </span>
              </label>
            )}
            {error && <Alert>{error}</Alert>}
            <Button type="submit" loading={loading} className="w-full">
              {signup ? "Create account" : "Sign in"}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-slate-500">
          {signup ? "Already have an account? " : "New to HireFlow? "}
          <Link href={signup ? "/login" : "/signup"} className="font-medium text-brand-600 hover:underline">
            {signup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
      <LegalFooter className="mt-10" />
    </div>
  );
}
