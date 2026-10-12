import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Gem } from "lucide-react";
import type { CardData } from "./CardDisplay";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "./CardDisplay";

type CardDetailProps = {
  card: CardData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CardDetail({ card, open, onOpenChange }: CardDetailProps) {
  const colors = CATEGORY_COLORS[card.category] ?? CATEGORY_COLORS.common;
  const remaining = (card.totalSupply ?? 0) - (card.claimedSupply ?? 0);
  const soldOut = remaining <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border bg-transparent p-0 sm:max-w-3xl">
        <div className="relative flex flex-col md:flex-row items-center gap-8 p-8">
          <div className={`relative aspect-[3/4] w-56 shrink-0 overflow-hidden rounded-xl border ${colors.border} ${colors.bg} p-2 shadow-2xl ${colors.glow}`}>
            <div className="relative h-full w-full rounded-lg border border-border/30 bg-background/30 overflow-hidden">
              {card.imageUrl ? (
                <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Gem className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              {soldOut && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="font-display text-xl font-bold text-white">SOLD OUT</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <h2 className={`font-display text-3xl font-black ${colors.text}`}>{card.name}</h2>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {CATEGORY_LABELS[card.category]} · Supply: {card.totalSupply}
            </p>

            {card.description && (
              <p className="text-sm text-muted-foreground">{card.description}</p>
            )}

            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Collected</span>
                <div className="font-bold text-lg">{card.claimedSupply}</div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Remaining</span>
                <div className={`font-bold text-lg ${soldOut ? "text-[hsl(var(--tsg-red))]" : "text-[hsl(var(--tsg-green))]"}`}>
                  {remaining}
                </div>
              </div>
              {card.holderCount !== undefined && (
                <div>
                  <span className="text-xs text-muted-foreground">Unique Holders</span>
                  <div className="font-bold text-lg">{card.holderCount}</div>
                </div>
              )}
            </div>

            {card.copyNumbers && card.copyNumbers.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Your Copies</span>
                <div className="flex flex-wrap gap-1">
                  {card.copyNumbers.map((num) => (
                    <span key={num} className="font-mono text-xs font-bold text-white bg-black/50 px-2 py-0.5 rounded">
                      #{num}/{card.totalSupply}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {soldOut && (
              <p className="text-sm font-bold text-[hsl(var(--tsg-red))]">This card is sold out and cannot be obtained.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
