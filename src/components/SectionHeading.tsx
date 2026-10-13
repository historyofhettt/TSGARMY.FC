import { cn } from "@/lib/utils";

type Props = {
  kicker?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({ kicker, title, description, align = "left", className }: Props) {
  return (
    <div className={cn("mb-8 md:mb-12", align === "center" && "text-center", className)}>
      {kicker && (
        <div
          className={cn(
            "mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.3em] uppercase text-[hsl(var(--tsg-blue))]",
            align === "center" && "justify-center",
          )}
        >
          <span className="h-px w-6 bg-[hsl(var(--tsg-blue)/0.6)]" />
          {kicker}
          {align === "center" && <span className="h-px w-6 bg-[hsl(var(--tsg-blue)/0.6)]" />}
        </div>
      )}
      <h2 className="font-display text-2xl md:text-4xl font-bold tracking-wide">{title}</h2>
      {description && (
        <p className={cn("mt-3 max-w-2xl text-muted-foreground", align === "center" && "mx-auto")}>
          {description}
        </p>
      )}
    </div>
  );
}
