"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";
import { cx } from "./ui";

const LABELS: Record<ApplicationStatus, string> = {
  generated: "Not applied",
  applied: "Applied",
  interview: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

const TONES: Record<ApplicationStatus, string> = {
  generated: "bg-slate-50 text-slate-700 border-slate-200",
  applied: "bg-brand-50 text-brand-700 border-brand-100",
  interview: "bg-amber-50 text-amber-800 border-amber-200",
  offer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export function StatusSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ApplicationStatus;
  onChange?: (s: ApplicationStatus) => void;
}) {
  const [status, setStatus] = useState(value);
  const [saving, setSaving] = useState(false);

  async function update(next: ApplicationStatus) {
    const prev = status;
    setStatus(next);
    setSaving(true);
    try {
      await api(`/api/applications/${id}`, { method: "PATCH", json: { status: next } });
      onChange?.(next);
    } catch {
      setStatus(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      aria-label="Application status"
      value={status}
      disabled={saving}
      onChange={(e) => update(e.target.value as ApplicationStatus)}
      className={cx("h-8 rounded-md border px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-100", TONES[status])}
    >
      {APPLICATION_STATUSES.map((s) => (
        <option key={s} value={s}>
          {LABELS[s]}
        </option>
      ))}
    </select>
  );
}
