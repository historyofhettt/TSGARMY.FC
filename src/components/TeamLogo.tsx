import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

type Props = {
  name: string;
  logoUrl?: string | null;
  accent?: "blue" | "red" | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizes = {
  sm: "h-10 w-10 text-xs",
  md: "h-16 w-16 text-lg",
  lg: "h-24 w-24 text-2xl",
  xl: "h-32 w-32 md:h-40 md:w-40 text-4xl",
};

/** Team logo — uploaded image, or a stylized monogram placeholder. */
export function TeamLogo({ name, logoUrl, accent = "blue", size = "md", className }: Props) {
  const ring =
    accent === "red"
      ? "from-[hsl(var(--tsg-red)/0.7)] to-transparent"
      : "from-[hsl(var(--tsg-blue)/0.7)] to-transparent";
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={cn("rounded-xl object-contain", sizes[size], className)}
        loading="lazy"
      />
    );
  }
  return (
    <div
      aria-label={`${name} logo placeholder`}
      className={cn(
        "relative flex items-center justify-center rounded-xl bg-gradient-to-br font-display font-bold",
        "from-[hsl(224_45%_12%)] to-[hsl(224_50%_6%)] border border-border",
        sizes[size],
        className,
      )}
    >
      <span className={cn("absolute inset-0 rounded-xl bg-gradient-to-br opacity-40", ring)} />
      <span className="relative">{initials(name)}</span>
    </div>
  );
}
