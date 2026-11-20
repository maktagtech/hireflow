import { Contact, LegalPage } from "@/components/legal-page";
import { site } from "@/lib/config";

export const metadata = { title: `Privacy Policy — ${site.name}` };

/*
 * Plain-language policy describing what this codebase actually does.
 * Keep it in sync with the product (new processors, analytics, cookies...) and
 * have it reviewed for the jurisdictions you operate in before launch.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {site.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is operated by {site.operator}. This policy explains what
        personal data we collect when you use {site.name}, why, who we share it with, and the choices you have. Résumés
        contain a lot of personal information, so we collect only what the service needs and give you tools to export
        or delete it at any time.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address and a hashed version of your password (we never
          store your actual password), plus when you accepted our Terms and Privacy Policy.
        </li>
        <li>
          <strong>Your résumé:</strong> the file you upload (PDF or DOCX) and the structured profile we extract from it —
          contact details, work history, education, skills, projects, certifications and anything else you include or
          edit.
        </li>
        <li>
          <strong>Jobs you add:</strong> job links and job descriptions you paste, the details we extract from them, and
          the status you set for each application (for example &ldquo;applied&rdquo; or &ldquo;interviewing&rdquo;).
        </li>
        <li>
          <strong>What we generate for you:</strong> tailored résumés, cover letters, match scores and keyword analysis.
        </li>
        <li>
          <strong>Technical data:</strong> a session cookie that keeps you signed in, and standard server logs (such as
          IP address, browser type and request times) used for security, abuse prevention and debugging.
        </li>
      </ul>
      <p>
        We don&apos;t use advertising or third-party tracking cookies. Please don&apos;t upload sensitive information
        that isn&apos;t needed for a job application (for example government ID numbers or health information).
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To provide the service: parse your résumé, analyze job descriptions, generate tailored documents and track your applications.</li>
        <li>To run your account: sign-in, password resets and essential service emails.</li>
        <li>To keep {site.name} secure and reliable: rate limiting, preventing abuse and fixing problems.</li>
        <li>To contact you about the beta if you were invited, including asking for feedback — you can tell us to stop at any time.</li>
      </ul>
      <p>
        We process this data to perform our contract with you (providing the service you signed up for) and, for
        security and service improvement, on the basis of our legitimate interests. We do not sell your personal data,
        and we don&apos;t use your résumé or documents to train AI models.
      </p>

      <h2>AI processing</h2>
      <p>
        To parse résumés and job descriptions and to write tailored content, {site.name} may send the relevant text —
        your résumé profile and the job description — to an AI model provider (such as Anthropic, OpenAI or Google)
        through their business API. The provider processes it to return a result to us under its API terms and
        data-processing commitments. AI-generated content can contain mistakes, so always review your documents before
        you send them; we automatically block suggestions that add skills or figures not found in your own profile.
      </p>

      <h2>Job links</h2>
      <p>
        When you paste a job URL, our servers fetch that public web page to read the job description. We don&apos;t
        log in to any site on your behalf.
      </p>

      <h2>Who we share data with</h2>
      <p>We share personal data only with service providers that help us run {site.name}, under contracts that limit their use of it:</p>
      <ul>
        <li>Cloud hosting and database providers, which store and serve the application and your data.</li>
        <li>File storage (for example Amazon Web Services S3), which stores uploaded and generated documents, encrypted at rest.</li>
        <li>AI model providers, as described above.</li>
        <li>An email delivery provider (for example Resend), to send password-reset and service emails.</li>
      </ul>
      <p>
        We may also disclose data if required by law, or to protect the rights and safety of our users or others. If
        {" "}{site.name} is involved in a merger or acquisition, your data may be transferred as part of that
        transaction, and we&apos;ll tell you before it becomes subject to a different privacy policy.
      </p>
      <p>
        Our providers may process data in countries other than yours. Where required, we rely on appropriate safeguards
        such as standard contractual clauses for those transfers.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while your account is active. When you replace your résumé, the previous file is deleted.
        When you delete an application, its generated documents are deleted. When you delete your account, we
        immediately and permanently delete your account, profile, uploaded files, job history and generated
        documents from our systems; copies may remain in encrypted backups for a limited period until they are
        overwritten. Server logs are kept only as long as needed for security and debugging.
      </p>

      <h2>Your rights and choices</h2>
      <ul>
        <li><strong>Access and portability:</strong> download all your data as a file from Settings → Download your data.</li>
        <li><strong>Correction:</strong> edit your profile at any time on the Master profile page.</li>
        <li><strong>Deletion:</strong> delete individual applications, or your whole account from Settings → Delete account.</li>
        <li>
          <strong>Other requests:</strong> depending on where you live, you may also have the right to object to or
          restrict certain processing and to complain to your data protection authority. Contact us at <Contact /> and
          we&apos;ll respond within the time the law requires.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        We use HTTPS, hash passwords with bcrypt, encrypt stored files at rest, scope every request to the signed-in
        account, and sign you out of all devices when your password changes. No system is perfectly secure, but we
        work to protect your data and will notify you of any breach as required by law.
      </p>

      <h2>Children</h2>
      <p>{site.name} is not intended for anyone under 16, and we don&apos;t knowingly collect their data.</p>

      <h2>Changes to this policy</h2>
      <p>
        If we make material changes, we&apos;ll update the date above and let you know by email or in the app before the
        changes take effect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests about your privacy: <Contact />.
      </p>
    </LegalPage>
  );
}
