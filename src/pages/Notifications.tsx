import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Heart, MessageCircle, UserPlus, Bell } from "lucide-react";
import { timeAgo } from "@/lib/time";

const ICON: Record<string, any> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  message: MessageCircle,
};
const TEXT: Record<string, string> = {
  like: "lajkol/a tvoj príspevok",
  comment: "okomentoval/a tvoj príspevok",
  follow: "ťa začal/a sledovať",
  message: "ti poslal/a správu",
};

export default function Notifications() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*, actor:profiles!notifications_actor_id_fkey(username, avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setItems(data ?? []);
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    })();
  }, [user]);

  return (
    <div>
      <header className="sticky top-0 z-30 glass safe-top">
        <div className="flex items-center gap-2 px-2 h-14">
          <button onClick={() => nav(-1)} className="p-2"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-bold text-lg">Notifikácie</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto">
        {items.length === 0 && (
          <div className="text-center py-20 px-6">
            <div className="w-20 h-20 mx-auto rounded-3xl gradient-brand-soft flex items-center justify-center mb-4">
              <Bell className="w-10 h-10 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Zatiaľ žiadne notifikácie.</p>
          </div>
        )}
        {items.map((n) => {
          const Icon = ICON[n.type] ?? Bell;
          return (
            <button
              key={n.id}
              onClick={() => {
                if (n.type === "message" && n.conversation_id) nav(`/chat/${n.conversation_id}`);
                else if (n.actor?.username) nav(`/u/${n.actor.username}`);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="relative">
                <Avatar src={n.actor?.avatar_url} alt={n.actor?.username} size={44} />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full gradient-brand flex items-center justify-center">
                  <Icon className="w-3 h-3 text-primary-foreground" fill={n.type === "like" ? "currentColor" : "none"} />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">{n.actor?.username ?? "niekto"}</span>{" "}
                  <span className="text-muted-foreground">{TEXT[n.type]}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
