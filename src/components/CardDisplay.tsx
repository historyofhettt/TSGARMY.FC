import { Gem } from "lucide-react";

export type CardCategory = "common" | "rare" | "epic" | "legendary" | "event" | "exclusive";

export const CATEGORY_LABELS: Record<CardCategory, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  event: "Event",
  exclusive: "Exclusive",
};

export const CATEGORY_COLORS: Record<CardCategory, { bg: string; text: string; border: string; glow: string }> = {
  common: { bg: "bg-slate-500/15", text: "text-slate-300", border: "border-slate-500/40", glow: "shadow-slate-500/20" },
  rare: { bg: "bg-blue-500/15", text: "text-blue-300", border: "border-blue-500/40", glow: "shadow-blue-500/20" },
  epic: { bg: "bg-purple-500/15", text: "text-purple-300", border: "border-purple-500/40", glow: "shadow-purple-500/20" },
  legendary: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/40", glow: "shadow-amber-500/20" },
  event: { bg: "bg-green-500/15", text: "text-green-300", border: "border-green-500/40", glow: "shadow-green-500/20" },
  exclusive: { bg: "bg-pink-500/15", text: "text-pink-300", border: "border-pink-500/40", glow: "shadow-pink-500/20" },
};

export type CardData = {
  id: number;
  name: string;
  slug: string;
  category: CardCategory;
  totalSupply: number;
  claimedSupply: number;
  description: string | null;
  imageKey: string | null;
  imageUrl?: string | null;
  holderCount?: number;
  remainingSupply?: number;
  isActive: boolean;
  quantity?: number;
  copyNumber?: number;
  copyNumbers?: number[];
};

type CardDisplayProps = {
  card: CardData;
  quantity?: number;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  showDetails?: boolean;
};

export function CardDisplay({ card, quantity, size = "md", onClick, showDetails = true }: CardDisplayProps) {
  const colors = CATEGORY_COLORS[card.category] ?? CATEGORY_COLORS.common;
  const remaining = (card.totalSupply ?? 0) - (card.claimedSupply ?? 0);
  const soldOut = remaining <= 0;
  const sizeClasses = {
    sm: "aspect-[3/4] min-w-[64px]",
    md: "aspect-[3/4] w-full xs:w-32 sm:w-36",
    lg: "aspect-[3/4] w-full xs:w-40 sm:w-48",
  };

  return (
    <div
      onClick={onClick}
      className={`group relative ${sizeClasses[size]} flex-shrink-0 cursor-pointer rounded-xl border ${colors.border} ${colors.bg} p-2 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl ${colors.glow} ${soldOut ? "opacity-60 grayscale" : ""}`}
    >
      <div className="relative h-full w-full rounded-lg border border-border/30 bg-background/30 overflow-hidden">
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gem className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="font-display text-xs font-bold text-white">SOLD OUT</span>
          </div>
        )}

        {quantity !== undefined && quantity > 0 && (
          <div className="absolute bottom-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
            ×{quantity}
          </div>
        )}

        {card.copyNumber && card.totalSupply > 1 && (
          <div className="absolute top-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
            #{card.copyNumber}/{card.totalSupply}
          </div>
        )}

        {card.copyNumbers && card.copyNumbers.length > 0 && card.totalSupply > 1 && (
          <div className="absolute top-1 left-1 rounded-full bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
            #{card.copyNumbers[0]}/{card.totalSupply}
          </div>
        )}
      </div>

      {showDetails && (
        <div className="mt-2 space-y-1">
          <p className={`font-display text-sm font-bold ${colors.text}`}>{card.name}</p>
          <p className={`text-xs uppercase tracking-widest ${colors.text}`}>
            {CATEGORY_LABELS[card.category]}
          </p>
          {quantity !== undefined && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Collected: {quantity}</span>
              <span>Owned: {quantity}/{card.totalSupply}</span>
            </div>
          )}
          {!quantity && (
            <div className="text-xs text-muted-foreground">
              {remaining} / {card.totalSupply} remaining
            </div>
          )}
        </div>
      )}
    </div>
  );
}
