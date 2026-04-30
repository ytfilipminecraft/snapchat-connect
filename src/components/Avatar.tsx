import { cn } from "@/lib/utils";

export function Avatar({
  src,
  alt,
  size = 40,
  ring = false,
  online = false,
  className,
}: {
  src?: string | null;
  alt?: string;
  size?: number;
  ring?: boolean;
  online?: boolean;
  className?: string;
}) {
  const initial = (alt ?? "?").charAt(0).toUpperCase();
  return (
    <div className={cn("relative inline-block", className)} style={{ width: size, height: size }}>
      <div
        className={cn(
          "rounded-full overflow-hidden flex items-center justify-center bg-secondary text-foreground font-semibold",
          ring && "ring-1 ring-border",
        )}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {src ? (
          <img src={src} alt={alt ?? ""} className="w-full h-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      {online && (
        <span
          className="absolute bottom-0 right-0 block rounded-full bg-success border-2 border-background"
          style={{ width: Math.max(8, size * 0.26), height: Math.max(8, size * 0.26) }}
        />
      )}
    </div>
  );
}
