import { useState } from "react";
import { Gem, Search } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { CardDisplay } from "@/components/CardDisplay";
import { CardDetail } from "@/components/CardDetail";
import { CATEGORY_LABELS, type CardCategory, type CardData } from "@/components/CardDisplay";

export default function CardCollection() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: collection, isLoading } = trpc.user.myCardCollection.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | "all">("all");
  const [detailCard, setDetailCard] = useState<CardData | null>(null);

  type CollectionItem = {
    card: CardData;
    quantity: number;
    copyNumbers: number[];
  };

  const grouped = (collection ?? []).reduce<CollectionItem[]>((acc, item) => {
    const card: CardData = {
      id: item.card.id,
      name: item.card.name,
      slug: item.card.slug,
      category: item.card.category,
      totalSupply: item.card.totalSupply,
      claimedSupply: item.card.claimedSupply,
      description: item.card.description,
      imageKey: item.card.imageKey,
      imageUrl: (item.card as Record<string, unknown> & { imageUrl?: string }).imageUrl ?? null,
      isActive: item.card.isActive,
      holderCount: 0,
      remainingSupply: item.card.totalSupply - item.card.claimedSupply,
    };

    const existing = acc.find((c) => c.card.id === card.id);
    if (existing) {
      existing.quantity += item.quantity;
      existing.copyNumbers.push(item.copyNumber);
    } else {
      acc.push({ card, quantity: item.quantity, copyNumbers: [item.copyNumber] });
    }
    return acc;
  }, []);

  const filtered = grouped.filter((c) => {
    if (selectedCategory !== "all" && c.card.category !== selectedCategory) return false;
    if (search && !c.card.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const categoryCounts = grouped.reduce(
    (acc, c) => {
      acc[c.card.category] = (acc[c.card.category] ?? 0) + 1;
      return acc;
    },
    {} as Record<CardCategory, number>,
  );

  const totalCards = grouped.length;
  const totalQuantity = grouped.reduce((s, c) => s + c.quantity, 0);

  if (authLoading || isLoading) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-6xl px-4 py-20 text-center text-muted-foreground">
          Loading your card collection...
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-2xl py-20 text-center">
          <Gem className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="font-display text-3xl font-bold mb-4">TSG CARD COLLECTION</h1>
          <p className="text-muted-foreground mb-8">
            Sign in to view your card collection. Complete daily streaks, hit XP milestones, and earn achievements to unlock cards!
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="font-display text-3xl font-black tracking-tight">MY CARD COLLECTION</h1>
          <p className="text-sm text-muted-foreground">
            {totalCards} unique cards · {totalQuantity} total collected
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
              All ({totalCards})
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
                {label} ({categoryCounts[key as CardCategory] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            {search || selectedCategory !== "all" ? (
              <p>No cards match your filters.</p>
            ) : (
              <>
                <Gem className="mx-auto mb-4 h-12 w-12 opacity-30" />
                <p>Your card collection is empty.</p>
                <p className="mt-2 text-sm">Earn cards by maintaining streaks, hitting XP milestones, and completing achievements!</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map(({ card, quantity, copyNumbers }) => (
              <div key={card.id} className="flex flex-col items-center">
                <CardDisplay
                  card={{ ...card, quantity, copyNumbers }}
                  onClick={() =>
                    setDetailCard({
                      ...card,
                      quantity,
                      copyNumbers,
                    })
                  }
                  size="md"
                />
                {copyNumbers.length > 0 && (
                  <div className="mt-1 flex flex-wrap justify-center gap-1 px-1">
                    {copyNumbers.map((num) => (
                      <span key={num} className="text-xs text-muted-foreground">
                        #{num}/{card.totalSupply}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {detailCard && (
          <CardDetail card={detailCard} open={!!detailCard} onOpenChange={(open) => !open && setDetailCard(null)} />
        )}
      </div>
    </PageLayout>
  );
}
