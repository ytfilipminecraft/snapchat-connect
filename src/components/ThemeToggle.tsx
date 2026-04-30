import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolved, setTheme } = useTheme();
  const Icon = resolved === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("p-2 text-foreground rounded-md hover:bg-secondary transition-colors", className)}
        aria-label="Prepnúť tému"
      >
        <Icon className="w-5 h-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")} className={theme === "light" ? "font-semibold" : ""}>
          <Sun className="w-4 h-4 mr-2" /> Svetlá
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className={theme === "dark" ? "font-semibold" : ""}>
          <Moon className="w-4 h-4 mr-2" /> Tmavá
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className={theme === "system" ? "font-semibold" : ""}>
          <Monitor className="w-4 h-4 mr-2" /> Systém
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
