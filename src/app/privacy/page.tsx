import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Neurogauge Neuroscience Lab collects, uses, stores, and protects participant and researcher data.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-[color:var(--muted)]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="px-6 md:px-10 pb-16 w-full">
      <div className="max-w-3xl mx-auto pt-10 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold mb-2">Privacy Policy</h1>
          <p className="text-sm text-[color:var(--muted)]">Last updated: 6 July 2026</p>
        </div>

        <div className="card p-4 border-amber-300 bg-amber-50 text-amber-900 text-sm">
          <strong>Draft — pending legal review.</strong> This policy describes our current practices
          but has not yet been reviewed by legal counsel. If you have questions, contact us before
          relying on it.
        </div>

        <Section title="1. Who we are">
          <p>
            Neurogauge Neuroscience Lab (&quot;Neurogauge&quot;, &quot;we&quot;, &quot;us&quot;) operates
            a cognitive assessment platform at https://www.neurogauge.africa that enables researchers to
            run N-back working memory studies and participants to complete assessments and review their
            own results. The platform is intended <strong>for research use only</strong> and is not a
            medical or diagnostic tool.
          </p>
        </Section>

        <Section title="2. Data we collect">
          <p>Depending on how you use the platform, we collect:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Participant data:</strong> the email address you provide before an assessment;
              cognitive task data such as reaction times, N-back accuracy (hits, misses, false alarms)
              and derived measures (e.g. d-prime, criterion); questionnaire responses (e.g. NASA-TLX and
              effort ratings); and basic demographic details a study may ask for (e.g. age range,
              education level).
            </li>
            <li>
              <strong>Researcher account data:</strong> your name, email address, and a hashed password.
            </li>
            <li>
              <strong>Technical data:</strong> a session cookie (JWT) used strictly for authentication.
              We do not use advertising or third-party tracking cookies.
            </li>
          </ul>
        </Section>

        <Section title="3. How we use data">
          <ul className="list-disc pl-5 space-y-1">
            <li>To run assessments and compute and display results.</li>
            <li>
              To make results available to the researcher(s) conducting the study, including CSV/SPSS
              export for analysis.
            </li>
            <li>To let participants retrieve their own results using the email they provided.</li>
            <li>To operate, secure, and improve the platform.</li>
          </ul>
          <p>We do not sell personal data or use it for advertising.</p>
        </Section>

        <Section title="4. Who can see your data">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Assessment results are accessible to the researcher who owns the study project and to
              collaborators they explicitly invite.
            </li>
            <li>Participants may retrieve their own session results.</li>
            <li>
              Researchers are responsible for handling exported data in line with their institution&apos;s
              ethics approval and applicable law.
            </li>
          </ul>
        </Section>

        <Section title="5. Where data is stored">
          <p>
            The application is hosted on Vercel, with data stored in a PostgreSQL database. A separate
            analytics service operated by us on a virtual private server processes result data to compute
            statistical analyses requested by researchers. All traffic is encrypted in transit over HTTPS.
          </p>
        </Section>

        <Section title="6. Data retention">
          <p>
            Assessment data is retained for as long as the associated research project remains active on
            the platform, or until the project owner deletes it. Researcher accounts are retained until
            deletion is requested.
          </p>
        </Section>

        <Section title="7. Your rights">
          <p>
            You may request access to, correction of, or deletion of your personal data at any time by
            contacting us at{" "}
            <a href="mailto:info@h-sets.com" className="text-[color:var(--primary)] hover:underline">
              info@h-sets.com
            </a>
            . If you participated in a specific study, we may refer your request to the responsible
            researcher where appropriate.
          </p>
        </Section>

        <Section title="8. Security">
          <p>
            Passwords are hashed with bcrypt and never stored in plain text. Authentication uses signed
            JWT session cookies. Access to research data is restricted to project owners and their invited
            collaborators.
          </p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will be reflected by the
            &quot;Last updated&quot; date above.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Questions about this policy or our data practices:{" "}
            <a href="mailto:info@h-sets.com" className="text-[color:var(--primary)] hover:underline">
              info@h-sets.com
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}
