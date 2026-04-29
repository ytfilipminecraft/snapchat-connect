import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/Avatar";
import { timeAgo, isOnline } from "@/lib/time";
import { MessageCircle } from "lucide-react";

type ChatRow = {
  id: string;
  other: { id: string; username: string; avatar_url: string | null; last_seen: string };
  last: { content: string | null; image_url: string | null; sender_id: string; created_at: string; read_at: string | null } | null;
  unread: number;
};

export default function ChatList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, user_a, user_b, last_message_at")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("last_message_at", { ascending: false });
    if (!convs) {
      setLoading(false);
      return;
    }
    const otherIds = convs.map((c: any) => (c.user_a === user.id ? c.user_b : c.user_a));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, last_seen")
      .in("id", otherIds);
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));

    const result: ChatRow[] = [];
    for (const c of convs) {
      const otherId = c.user_a === user.id ? c.user_b : c.user_a;
      const { data: last } = await supabase
        .from("messages")
        .select("content, image_url, sender_id, created_at, read_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .neq("sender_id", user.id)
        .is("read_at", null);
      result.push({
        id: c.id,
        other: profMap.get(otherId) as any,
        last: last as any,
        unread: count ?? 0,
      });
    }
    setRows(result.filter((r) => r.other));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div>
      <header className="sticky top-0 z-30 glass safe-top px-4 h-14 flex items-center">
        <h1 className="text-xl font-bold">Správy</h1>
      </header>

      <div className="max-w-md mx-auto">
        {loading && <p className="text-center py-12 text-muted-foreground text-sm">Načítavam…</p>}
        {!loading && rows.length === 0 && (
          <div className="text-center py-20 px-6">
            <div className="w-20 h-20 mx-auto rounded-3xl gradient-brand-soft flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-primary" />
            </div>
            <h2 className="font-bold mb-2">Žiadne správy</h2>
            <p className="text-sm text-muted-foreground">Nájdi niekoho v Hľadať a začni rozhovor.</p>
          </div>
        )}
        {rows.map((r) => {
          const lastText = r.last
            ? r.last.image_url
              ? "📷 Fotka"
              : r.last.content ?? ""
            : "Začni konverzáciu";
          return (
            <Link
              key={r.id}
              to={`/chat/${r.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
            >
              <Avatar src={r.other.avatar_url} alt={r.other.username} size={56} online={isOnline(r.other.last_seen)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate">{r.other.username}</span>
                  {r.last && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(r.last.created_at)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p
                    className={`text-sm truncate ${
                      r.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {lastText}
                  </p>
                  {r.unread > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full gradient-brand text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {r.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
