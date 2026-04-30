import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ImagePlus, Send } from "lucide-react";
import { formatTime, isOnline } from "@/lib/time";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
};

export default function ChatRoom() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const [other, setOther] = useState<any>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // load conv + other user + messages
  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("user_a, user_b")
        .eq("id", id)
        .maybeSingle();
      if (!conv) {
        toast.error("Konverzácia neexistuje");
        nav("/chat");
        return;
      }
      const otherId = conv.user_a === user.id ? conv.user_b : conv.user_a;
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, last_seen, is_verified")
        .eq("id", otherId)
        .maybeSingle();
      setOther(prof);

      const { data: messages } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });
      setMsgs((messages as Msg[]) ?? []);

      // mark inbound as read
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", id)
        .neq("sender_id", user.id)
        .is("read_at", null);
    })();
  }, [id, user, nav]);

  // realtime
  useEffect(() => {
    if (!id || !user) return;
    const ch = supabase
      .channel(`conv-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        async (payload) => {
          const m = payload.new as Msg;
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== user.id) {
            await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Msg;
          setMsgs((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${other?.id}` },
        (payload) => setOther((o: any) => ({ ...o, ...payload.new })),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, user, other?.id]);

  // autoscroll bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    if (!user || !id || !text.trim()) return;
    const content = text.trim().slice(0, 2000);
    setText("");
    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: user.id, content })
      .select("*")
      .single();
    setSending(false);
    if (error) {
      toast.error(error.message);
      setText(content);
      return;
    }
    if (data) setMsgs((p) => (p.some((x) => x.id === (data as any).id) ? p : [...p, data as Msg]));
    if (other) {
      await supabase.from("notifications").insert({
        user_id: other.id,
        actor_id: user.id,
        type: "message",
        conversation_id: id,
      });
    }
  };

  const sendPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user || !id) return;
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Max 8MB");
      return;
    }
    const path = `${user.id}/${Date.now()}-${f.name}`;
    const { error: upErr } = await supabase.storage.from("messages").upload(path, f, { contentType: f.type });
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    // Store storage path; signed URLs are generated on render
    const { data } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: user.id, image_url: path })
      .select("*")
      .single();
    if (data) setMsgs((p) => (p.some((x) => x.id === (data as any).id) ? p : [...p, data as Msg]));
    if (other) {
      await supabase.from("notifications").insert({
        user_id: other.id,
        actor_id: user.id,
        type: "message",
        conversation_id: id,
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="glass safe-top border-b border-border/40">
        <div className="flex items-center gap-3 px-2 h-14">
          <button onClick={() => nav("/chat")} className="p-2 text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          {other && (
            <>
              <Avatar src={other.avatar_url} alt={other.username} size={36} online={isOnline(other.last_seen)} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{other.username}</p>
                <p className="text-[11px] text-muted-foreground">
                  {isOnline(other.last_seen) ? "online" : "offline"}
                </p>
              </div>
            </>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {msgs.map((m, i) => {
          const mine = m.sender_id === user?.id;
          const prev = msgs[i - 1];
          const showTime = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
          const isLastMine = mine && i === msgs.length - 1;
          return (
            <div key={m.id} className="space-y-1">
              {showTime && (
                <p className="text-center text-[10px] text-muted-foreground py-2">{formatTime(m.created_at)}</p>
              )}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl overflow-hidden animate-scale-in",
                    m.image_url ? "p-1" : "px-4 py-2.5 text-sm",
                    mine ? "bubble-sent text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm",
                  )}
                >
                  {m.image_url ? (
                    <SignedImage path={m.image_url} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
              {isLastMine && (
                <p className="text-[10px] text-muted-foreground text-right pr-1">
                  {m.read_at ? "✓✓ Prečítané" : "✓ Odoslané"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-2 border-t border-border/40 safe-bottom flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" onChange={sendPhoto} className="hidden" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileRef.current?.click()}
          className="text-primary"
        >
          <ImagePlus className="w-5 h-5" />
        </Button>
        <Input
          placeholder="Správa…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          maxLength={2000}
          className="flex-1 rounded-full bg-secondary border-0 h-10"
        />
        <Button
          size="icon"
          onClick={send}
          disabled={sending || !text.trim()}
          className="gradient-brand text-primary-foreground rounded-full"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
