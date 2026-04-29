import { cn } from "@/lib/utils";

export function PostSkeleton() {
  return (
    <div className="border-b border-border/40 pb-4 animate-pulse">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
      <div className="aspect-square w-full bg-muted" />
      <div className="px-4 pt-3 space-y-2">
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
      </div>
    </div>
  );
}

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-muted rounded-md",
        "bg-gradient-to-r from-muted via-secondary to-muted bg-[length:200%_100%] animate-shimmer",
        className,
      )}
    />
  );
}
