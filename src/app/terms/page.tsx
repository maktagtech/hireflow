import Link from "next/link";
import { Contact, LegalPage } from "@/components/legal-page";
import { site } from "@/lib/config";

export const metadata = { title: `Terms of Service — ${site.name}` };

/*
 * Draft terms for a free beta. Before charging money or launching broadly, add
 * governing law / dispute resolution for your jurisdiction and have a lawyer
 * review the warranty and liability sections.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern your use of {site.name}, operated by {site.operator}. By creating an account you agree to
        them and to our <Link href="/privacy">Privacy Policy</Link>. If you don&apos;t agree, please don&apos;t use
        the service.
      </p>

      <h2>The beta</h2>
      <p>
        {site.name} is currently in beta. It&apos;s free during the beta, features may change, and we may suspend or
        end the beta at any time. We&apos;ll give reasonable notice before shutting down so you can export your data.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 16 years old and provide accurate account information.</li>
        <li>Keep your password secure; you&apos;re responsible for activity under your account.</li>
        <li>Invite codes are personal unless we tell you otherwise — please don&apos;t sell or publish them.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You own the résumés, job descriptions and other content you add, and the documents we generate for you. You
        give us permission to store and process that content only as needed to provide {site.name} to you, as
        described in the Privacy Policy. You confirm you have the right to upload what you add — for example, only
        upload your own résumé.
      </p>

      <h2>Be truthful — and review everything</h2>
      <p>
        {site.name} is designed to present your real experience in the best light, not to invent it. You&apos;re
        responsible for the accuracy of every document you send to an employer. AI-generated content can contain
        mistakes, so review and correct your résumé and cover letter before applying. Match scores are our own
        estimate of keyword and skill coverage; they aren&apos;t a score from any employer&apos;s system.
      </p>

      <h2>No guarantee of outcomes</h2>
      <p>
        We work hard to help you get more interviews, but we can&apos;t guarantee interviews, job offers or any hiring
        decision. Employers make their own decisions.
      </p>

      <h2>Acceptable use</h2>
      <p>Don&apos;t use {site.name} to:</p>
      <ul>
        <li>create misleading or fraudulent applications, or impersonate someone else;</li>
        <li>upload other people&apos;s personal data without their permission;</li>
        <li>break the law or the terms of websites whose job postings you import;</li>
        <li>probe, overload or attack the service, or access it by automated means other than as we provide;</li>
        <li>resell or redistribute the service.</li>
      </ul>
      <p>We may suspend or close accounts that break these rules.</p>

      <h2>Ending your use</h2>
      <p>
        You can delete your account at any time in Settings, which permanently deletes your data as described in the
        Privacy Policy. We may close your account if you break these terms or if we end the service, and we&apos;ll
        tell you when we reasonably can.
      </p>

      <h2>Disclaimers and liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, to
        the fullest extent permitted by law. To the extent the law allows, we aren&apos;t liable for indirect or
        consequential losses (such as lost job opportunities), and our total liability for any claim relating to the
        service is limited to the amount you paid us in the 12 months before the claim (during the free beta, zero).
        Nothing in these terms limits liability that can&apos;t be limited by law, or your statutory rights as a
        consumer.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. For material changes we&apos;ll notify you by email or in the app before they take
        effect; continuing to use {site.name} afterwards means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <Contact />.
      </p>
    </LegalPage>
  );
}
