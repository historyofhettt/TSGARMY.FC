import { Youtube, Instagram, Twitter, MessagesSquare } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { PageLayout } from "@/components/PageLayout";
import { SectionHeading } from "@/components/SectionHeading";

export default function Contact() {
  const { data: org } = trpc.public.org.useQuery();
  const socials = [
    { href: org?.youtube, icon: Youtube, label: "YouTube", handle: "TSG on YouTube" },
    { href: org?.instagram, icon: Instagram, label: "Instagram", handle: "TSG on Instagram" },
    { href: org?.x, icon: Twitter, label: "X", handle: "TSG on X" },
    { href: org?.discord, icon: MessagesSquare, label: "Discord", handle: "TSG Discord server" },
  ].filter((s) => s.href);

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-4 py-14 md:px-8">
        <SectionHeading
          kicker="Reach Out"
          title="CONTACT"
          description="For business inquiries, partnerships, and press — reach us on any official channel."
        />
        {socials.length === 0 ? (
          <p className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
            Official contact channels will be published soon.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {socials.map((s) => (
              <a key={s.label} href={s.href!} target="_blank" rel="noreferrer">
                <div className="glass flex items-center gap-4 rounded-xl p-5 transition hover:border-[hsl(var(--tsg-blue)/0.5)]">
                  <s.icon className="h-6 w-6 text-[hsl(var(--tsg-blue))]" />
                  <div>
                    <p className="font-semibold">{s.label}</p>
                    <p className="text-sm text-muted-foreground">{s.handle}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
