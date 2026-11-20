"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import { LegalFooter } from "./legal-footer";
import { Spinner, cx } from "./ui";

type Me = { user: { name: string; email: string }; hasProfile: boolean; ai: string };

const NAV = [
  { href: "/dashboard", label: "Dashboard", short: "Dashboard" },
  { href: "/profile", label: "Master profile", short: "Profile" },
  { href: "/settings", label: "Settings", short: "Settings" },
];

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
      <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-sm text-white">H</span>
      <span className={compact ? "hidden sm:inline" : undefined}>HireFlow</span>
    </span>
  );
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex gap-0.5 sm:gap-1">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={cx(
            "rounded-md px-2 py-1.5 text-sm sm:px-3",
            pathname?.startsWith(n.href) ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:text-slate-900",
          )}
        >
          <span className="sm:hidden">{n.short}</span>
          <span className="hidden sm:inline">{n.label}</span>
        </Link>
      ))}
    </nav>
  );
}

// usePathname suspends on routes with request-time params (e.g. /applications/[id]).
function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch(() => {});
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6">
          <Link href="/dashboard" aria-label="HireFlow dashboard">
            <Logo compact />
          </Link>
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNavLinks />
          </Suspense>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {me && (
              <span className="hidden text-slate-500 sm:inline" title={`AI engine: ${me.ai}`}>
                {me.user.name || me.user.email}
              </span>
            )}
            <button onClick={logout} className="whitespace-nowrap text-slate-600 hover:text-slate-900">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense
          fallback={
            <div className="flex justify-center p-20 text-slate-400">
              <Spinner />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
      <LegalFooter className="border-t border-slate-200 py-6" />
    </div>
  );
}
