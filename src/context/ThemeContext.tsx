import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

type Ctx = { theme: Theme; resolved: Resolved; setTheme: (t: Theme) => void };
const ThemeCtx = createContext<Ctx | undefined>(undefined);

const KEY = "pc.theme";

function applyTheme(resolved: Resolved) {
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#121212" : "#ffffff");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return ((localStorage.getItem(KEY) as Theme) || "system");
  });
  const [resolved, setResolved] = useState<Resolved>("light");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const compute = (): Resolved =>
      theme === "system" ? (mq.matches ? "dark" : "light") : theme;
    const next = compute();
    setResolved(next);
    applyTheme(next);
    const listener = () => {
      if (theme === "system") {
        const r = mq.matches ? "dark" : "light";
        setResolved(r);
        applyTheme(r);
      }
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem(KEY, t);
    setThemeState(t);
  };

  return <ThemeCtx.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme must be inside ThemeProvider");
  return v;
}
