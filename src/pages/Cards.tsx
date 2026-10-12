import { useState } from "react";
import { Gem, Search } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { trpc } from "@/providers/trpc";
import { CardDisplay } from "@/components/CardDisplay";
import { CardDetail } from "@/components/CardDetail";
import { CATEGORY_LABELS, type CardCategory, type CardData } from "@/components/CardDisplay";

export default function CardsShowcase() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | "all">("all");
  const [detailSlug, setDetailSlug] = useState<string | null>(null);

  // Fetch all cards via listCards or by scanning through available slugs
  // For the showcase, we'll use a public query that lists all active cards
  const { data: allCards, isLoading } = trpc.public.listActiveCards.useQuery();

  // If listCards doesn't exist, we can use a simpler approach
  // For now, let's assume we have listCards
  const cards: CardData[] = (allCards ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    category: c.category,
    totalSupply: c.totalSupply,
    claimedSupply: c.claimedSupply,
    description: c.description,
    imageKey: c.imageKey,
    imageUrl: (c as unknown as { imageUrl?: string }).imageUrl ?? null,
    isActive: c.isActive,
    remainingSupply: c.totalSupply - c.claimedSupply,
  }));

  const filtered = cards.filter((c) => {
    if (!c.isActive) return false;
    if (selectedCategory !== "all" && c.category !== selectedCategory) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (isLoading) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-6xl px-4 py-20 text-center text-muted-foreground">
          Loading cards...
        </div>
      </PageLayout>
    );
  }

  // For detail view, we need to fetch by slug
  const DetailView = () => {
    if (!detailSlug) return null;
    const { data: card } = trpc.user.cardBySlug.useQuery(
      { slug: detailSlug },
      { enabled: !!detailSlug, staleTime: 0 },
    );
    if (!card) return null;
    return (
      <CardDetail
        card={card}
        open={true}
        onOpenChange={(open) => !open && setDetailSlug(null)}
      />
    );
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="font-display text-3xl font-black tracking-tight">TSG CARD GALLERY</h1>
          <p className="text-sm text-muted-foreground">Collect all cards through streaks, XP milestones, and achievements!</p>
        </div>

        <div className="mb-6 mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search cards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--tsg-blue))]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold uppercase ${
                selectedCategory === "all"
                  ? "bg-[hsl(var(--tsg-blue))] text-white"
                  : "border border-border bg-background/40 text-muted-foreground hover:bg-accent"
              }`}
            >
              All
            </button>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key as CardCategory)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold uppercase ${
                  selectedCategory === key
                    ? "bg-[hsl(var(--tsg-blue))] text-white"
                    : "border border-border bg-background/40 text-muted-foreground hover:bg-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Gem className="mx-auto mb-4 h-12 w-12 opacity-30" />
            <p>No cards found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((card) => (
              <CardDisplay
                key={card.id}
                card={card}
                onClick={() => setDetailSlug(card.slug)}
                size="md"
              />
            ))}
          </div>
        )}

        <DetailView />
      </div>
    </PageLayout>
  );
}
