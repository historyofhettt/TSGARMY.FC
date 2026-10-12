import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

type Props = {
  ign: string;
  photoUrl?: string | null;
  className?: string;
  rounded?: string;
};

/** Player photo — uploaded image, or a monogram placeholder panel. */
export function PlayerPhoto({ ign, photoUrl, className, rounded = "rounded-xl" }: Props) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={ign}
        className={cn("object-cover", rounded, className)}
        loading="lazy"
      />
    );
  }
  return (
    <div
      aria-label={`${ign} photo placeholder`}
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-[hsl(224_45%_14%)] to-[hsl(224_50%_7%)] font-display font-bold text-muted-foreground",
        rounded,
        className,
      )}
    >
      {initials(ign)}
    </div>
  );
}
