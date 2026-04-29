import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, Search, PlusSquare, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const tabs = [
  { to: "/", icon: Home, label: "Feed" },
  { to: "/search", icon: Search, label: "Hľadať" },
  { to: "/create", icon: PlusSquare, label: "Pridať", center: true },
  { to: "/chat", icon: MessageCircle, label: "Chat" },
  { to: "/profile", icon: User, label: "Profil" },
];

export default function TabsLayout() {
  const loc = useLocation();
  const { user } = useAuth();
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [unreadNotif, setUnreadNotif] = useState(0);

  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      // unread messages: messages where I'm in conversation and not sender and read_at null
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      const ids = (convs ?? []).map((c: { id: string }) => c.id);
      if (ids.length) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", ids)
          .neq("sender_id", user.id)
          .is("read_at", null);
        setUnreadMsgs(count ?? 0);
      } else setUnreadMsgs(0);

      const { count: nc } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnreadNotif(nc ?? 0);
    };
    refresh();

    const ch = supabase
      .channel("badge-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/60 safe-bottom",
        )}
      >
        <div className="grid grid-cols-5 max-w-md mx-auto">
          {tabs.map(({ to, icon: Icon, label, center }) => {
            const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
            const badge =
              to === "/chat" ? unreadMsgs : to === "/profile" ? unreadNotif : 0;
            return (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  "relative flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors",
                  center && "scale-110",
                )}
              >
                <div
                  className={cn(
                    "relative p-2 rounded-2xl transition-all",
                    center && active && "gradient-brand shadow-brand",
                    center && !active && "gradient-brand-soft",
                    !center && active && "text-primary",
                    !center && !active && "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("w-6 h-6", center && "text-primary-foreground")} strokeWidth={active ? 2.5 : 2} />
                  {badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                    center && "sr-only",
                  )}
                >
                  {label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
