import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";

export default function Privacy() {
  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-4 py-14 md:px-8">
        <SectionHeading kicker="Legal" title="PRIVACY POLICY" />
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            Two Side Gamers ("TSG") respects your privacy. This policy explains what information we
            collect when you use this website and how we use it.
          </p>
          <section>
            <h2 className="mb-2 font-display text-base font-bold text-foreground">Information we collect</h2>
            <p>
              When you sign in to comment, we receive your basic profile information (name and avatar)
              from the authentication provider. We store your comments, replies, and reactions along
              with a timestamp.
            </p>
          </section>
          <section>
            <h2 className="mb-2 font-display text-base font-bold text-foreground">How we use it</h2>
            <p>
              Profile information is used only to display your identity next to your community
              activity. We do not sell or share your data with third parties for marketing.
            </p>
          </section>
          <section>
            <h2 className="mb-2 font-display text-base font-bold text-foreground">Your choices</h2>
            <p>
              You can edit or delete your own comments at any time. To request full removal of your
              account data, contact us through any official channel listed on the Contact page.
            </p>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
