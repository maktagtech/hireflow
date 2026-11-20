import Link from "next/link";
import { site } from "@/lib/config";
import { cx } from "./ui";

export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cx("flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500", className)}>
      <span>© {site.name}</span>
      <Link href="/privacy" className="hover:text-slate-900">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-slate-900">
        Terms
      </Link>
      {site.contactEmail && (
        <a href={`mailto:${site.contactEmail}`} className="hover:text-slate-900">
          Contact
        </a>
      )}
    </footer>
  );
}
