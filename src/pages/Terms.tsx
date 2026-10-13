import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";

export default function Terms() {
  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-4 py-14 md:px-8">
        <SectionHeading kicker="Legal" title="TERMS OF SERVICE" />
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            By using the Two Side Gamers website you agree to these terms. Content on this site —
            including rosters, statistics, and tournament data — is provided for informational
            purposes.
          </p>
          <section>
            <h2 className="mb-2 font-display text-base font-bold text-foreground">Accounts</h2>
            <p>
              You are responsible for activity under your account. We may restrict accounts that
              abuse the platform.
            </p>
          </section>
          <section id="guidelines">
            <h2 className="mb-2 font-display text-base font-bold text-foreground">Community Guidelines</h2>
            <ul className="list-inside list-disc space-y-1.5">
              <li>Be respectful — no harassment, hate speech, or personal attacks.</li>
              <li>No spam, advertising, or malicious links.</li>
              <li>Do not impersonate players, staff, or other users.</li>
              <li>Moderators may hide or remove content and restrict accounts that violate these rules.</li>
            </ul>
          </section>
          <section>
            <h2 className="mb-2 font-display text-base font-bold text-foreground">Intellectual property</h2>
            <p>
              TSG branding, logos, and original content belong to Two Side Gamers. Do not reuse them
              without permission.
            </p>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
