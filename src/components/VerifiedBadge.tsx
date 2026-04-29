import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return <BadgeCheck className={cn("w-4 h-4 text-primary fill-primary/20", className)} />;
}
