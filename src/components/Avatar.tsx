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
          "rounded-full overflow-hidden flex items-center justify-center bg-secondary text-foreground font-bold",
          ring && "p-[2px] ring-story",
        )}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {src ? (
          <img src={src} alt={alt ?? ""} className={cn("w-full h-full object-cover", ring && "rounded-full bg-background p-[2px]")} />
        ) : (
          <span className={cn(ring && "rounded-full bg-secondary w-full h-full flex items-center justify-center")}>
            {initial}
          </span>
        )}
      </div>
      {online && (
        <span
          className="absolute bottom-0 right-0 block rounded-full bg-success border-2 border-background"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
