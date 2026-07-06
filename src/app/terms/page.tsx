import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms governing use of the Neurogauge Neuroscience Lab cognitive assessment platform by researchers and participants.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-[color:var(--muted)]">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="px-6 md:px-10 pb-16 w-full">
      <div className="max-w-3xl mx-auto pt-10 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold mb-2">Terms of Service</h1>
          <p className="text-sm text-[color:var(--muted)]">Last updated: 6 July 2026</p>
        </div>

        <div className="card p-4 border-amber-300 bg-amber-50 text-amber-900 text-sm">
          <strong>Draft — pending legal review.</strong> These terms describe our intended agreement
          with users but have not yet been reviewed by legal counsel.
        </div>

        <Section title="1. Acceptance of terms">
          <p>
            By creating an account, taking an assessment, or otherwise using the Neurogauge platform
            (&quot;the Service&quot;), you agree to these Terms of Service and to our Privacy Policy.
            If you do not agree, do not use the Service.
          </p>
        </Section>

        <Section title="2. Description of the Service">
          <p>
            Neurogauge provides research-grade cognitive assessment tools, including N-back working
            memory tasks, workload questionnaires (e.g. NASA-TLX), result computation, and data export
            for researchers. The Service is provided <strong>for research use only</strong>. It is not a
            medical device and must not be used for clinical diagnosis, treatment decisions, or any
            medical purpose.
          </p>
        </Section>

        <Section title="3. Researcher responsibilities">
          <p>If you use the Service to run studies, you are responsible for:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Obtaining any required institutional ethics approval (e.g. IRB/REC) before collecting data
              from participants.
            </li>
            <li>Obtaining informed consent from your participants.</li>
            <li>
              Handling data you export from the Service lawfully and in accordance with your ethics
              approval and applicable data protection law.
            </li>
            <li>Only inviting collaborators who are authorised to access your study data.</li>
          </ul>
        </Section>

        <Section title="4. Participant terms">
          <p>
            Participation in assessments is voluntary. By providing your email address and completing an
            assessment, you consent to the collection and processing of your assessment data as described
            in our Privacy Policy, and to the responsible researcher accessing your results for their study.
          </p>
        </Section>

        <Section title="5. Accounts and security">
          <p>
            You are responsible for keeping your account credentials confidential and for all activity
            under your account. Notify us promptly of any suspected unauthorised access.
          </p>
        </Section>

        <Section title="6. Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access or attempt to access data belonging to other users or studies.</li>
            <li>Interfere with or disrupt the Service, or attempt to bypass security measures.</li>
            <li>Use the Service to collect data without appropriate consent or legal basis.</li>
            <li>Misrepresent the Service as a medical or diagnostic tool.</li>
          </ul>
        </Section>

        <Section title="7. Intellectual property">
          <p>
            The Service, including its software, design, and content, is owned by Neurogauge Neuroscience
            Lab and its licensors. Researchers retain rights to the study data they collect through the
            Service, subject to these terms.
          </p>
        </Section>

        <Section title="8. Disclaimers and limitation of liability">
          <p>
            The Service is provided &quot;as is&quot; without warranties of any kind, express or implied,
            including fitness for a particular purpose. Assessment scores are research measurements and
            carry no clinical meaning. To the maximum extent permitted by law, Neurogauge shall not be
            liable for any indirect, incidental, or consequential damages arising from use of the Service.
          </p>
        </Section>

        <Section title="9. Termination">
          <p>
            We may suspend or terminate access to the Service for breach of these terms. You may stop
            using the Service and request deletion of your account and data at any time.
          </p>
        </Section>

        <Section title="10. Governing law">
          <p>
            These terms are governed by the laws of [Jurisdiction — TBD by legal review], without regard
            to conflict-of-law principles.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Questions about these terms:{" "}
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
