import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/password-forms";

export const metadata = {
  title: "Choose a new password — HireFlow",
  // Keep reset tokens out of referrers and search engines.
  referrer: "no-referrer",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
