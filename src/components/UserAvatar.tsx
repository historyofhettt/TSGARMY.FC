import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  name?: string | null;
  username?: string | null;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
  xl: "h-24 w-24 text-2xl",
};

function resolveSrc(src?: string | null): string | null {
  if (!src) return null;
  return src.startsWith("http") ? src : `/uploads/${src}`;
}

export function UserAvatar({ src, name, username, alt, size = "md", className }: Props) {
  const [error, setError] = useState(false);
  const resolved = resolveSrc(src);
  const fallbackText = (name || username || "?").slice(0, 1).toUpperCase();
  const fallbackClassName = "flex items-center justify-center rounded-full font-display font-bold bg-[hsl(var(--tsg-blue)/0.15)] text-[hsl(var(--tsg-blue))]";

  if (!resolved || error) {
    return (
      <span
        aria-label={alt ?? `${fallbackText} avatar`}
        className={cn(fallbackClassName, sizeClasses[size], className)}
      >
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt ?? fallbackText}
      className={cn("rounded-full object-cover", sizeClasses[size], className)}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}
