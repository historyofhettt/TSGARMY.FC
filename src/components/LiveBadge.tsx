import { cn } from "@/lib/utils";

export function LiveBadge({ className, label = "LIVE" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--tsg-red)/0.15)] border border-[hsl(var(--tsg-red)/0.5)] px-2.5 py-0.5 text-xs font-bold tracking-widest text-[hsl(var(--tsg-red))]",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--tsg-red))] animate-live-pulse" />
      {label}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  if (status === "ongoing") return <LiveBadge className={className} />;
  const styles =
    status === "upcoming"
      ? "bg-[hsl(var(--tsg-blue)/0.12)] border-[hsl(var(--tsg-blue)/0.4)] text-[hsl(var(--tsg-blue))]"
      : "bg-muted border-border text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-widest uppercase",
        styles,
        className,
      )}
    >
      {status}
    </span>
  );
}
