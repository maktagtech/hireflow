import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/lib/config";
import { Logo } from "./app-shell";
import { LegalFooter } from "./legal-footer";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const unconfigured = !process.env.NEXT_PUBLIC_OPERATOR_NAME || !site.contactEmail;
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center px-4">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6">
        {unconfigured && process.env.NODE_ENV !== "production" && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Dev note: set <code>NEXT_PUBLIC_OPERATOR_NAME</code> and <code>NEXT_PUBLIC_CONTACT_EMAIL</code> before
            publishing, and have these documents reviewed for your jurisdiction.
          </div>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated {site.policyUpdated}</p>
        <div className="legal mt-8 space-y-4 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc [&_a]:text-brand-600 [&_a]:underline">
          {children}
        </div>
      </main>
      <LegalFooter className="border-t border-slate-100 py-6" />
    </div>
  );
}

export function Contact() {
  return site.contactEmail ? <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> : <>the contact address on our website</>;
}
