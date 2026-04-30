import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { PostCard, FeedPost } from "@/components/PostCard";
import { PostSkeleton } from "@/components/Skeletons";
import { Bell } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const PAGE = 8;

export default function Feed() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(
    async (p: number, replace = false) => {
      if (!user) return;
      const from = p * PAGE;
      const to = from + PAGE - 1;
      const { data: rows } = await supabase
        .from("posts")
        .select("id, user_id, image_url, caption, created_at, profile:profiles!posts_user_id_fkey(username, avatar_url, is_verified)")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (!rows) return;

      const ids = rows.map((r: any) => r.id);
      const [{ data: likeRows }, { data: myLikes }, { data: commentRows }] = await Promise.all([
        supabase.from("likes").select("post_id").in("post_id", ids),
        supabase.from("likes").select("post_id").in("post_id", ids).eq("user_id", user.id),
        supabase.from("comments").select("post_id").in("post_id", ids),
      ]);
      const likeMap = new Map<string, number>();
      (likeRows ?? []).forEach((r: any) => likeMap.set(r.post_id, (likeMap.get(r.post_id) ?? 0) + 1));
      const commentMap = new Map<string, number>();
      (commentRows ?? []).forEach((r: any) => commentMap.set(r.post_id, (commentMap.get(r.post_id) ?? 0) + 1));
      const likedSet = new Set((myLikes ?? []).map((r: any) => r.post_id));

      const enriched: FeedPost[] = rows.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        image_url: r.image_url,
        caption: r.caption,
        created_at: r.created_at,
        profile: r.profile,
        likes_count: likeMap.get(r.id) ?? 0,
        comments_count: commentMap.get(r.id) ?? 0,
        liked_by_me: likedSet.has(r.id),
      }));

      setPosts((prev) => (replace ? enriched : [...prev, ...enriched]));
      setHasMore(rows.length === PAGE);
    },
    [user],
  );

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchPage(0, true).finally(() => setLoading(false));
  }, [user, fetchPage]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .then(({ count }) => setUnreadNotif(count ?? 0));
  }, [user]);

  // infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || loading || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const next = page + 1;
          setPage(next);
          fetchPage(next);
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [page, hasMore, loading, fetchPage]);

  // pull to refresh (simple touch impl)
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && (document.scrollingElement?.scrollTop ?? 0) === 0) {
      startY.current = e.touches[0].clientY;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(dy, 100));
  };
  const onTouchEnd = async () => {
    if (pull > 70) {
      setRefreshing(true);
      setPage(0);
      await fetchPage(0, true);
      setRefreshing(false);
    }
    setPull(0);
    startY.current = null;
  };

  // refresh on tab focus
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        setPage(0);
        fetchPage(0, true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchPage]);

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Header */}
      <header className="sticky top-0 z-30 glass safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight gradient-text">PulseChat</h1>
          </div>
          <button
            onClick={() => nav("/notifications")}
            className="relative p-2 -mr-2 text-foreground"
            aria-label="Notifikácie"
          >
            <Bell className="w-6 h-6" />
            {unreadNotif > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadNotif > 9 ? "9+" : unreadNotif}
              </span>
            )}
          </button>
        </div>
      </header>

      {pull > 0 && (
        <div className="text-center py-2 text-xs text-muted-foreground">
          {pull > 70 ? "Pusti pre obnovenie" : "Potiahni nadol…"}
        </div>
      )}
      {refreshing && <div className="text-center py-2 text-xs text-primary">Obnovujem…</div>}

      <div className="max-w-md mx-auto">
        {loading && (
          <>
            <PostSkeleton />
            <PostSkeleton />
          </>
        )}

        {!loading && posts.length === 0 && (
          <div className="text-center py-20 px-6">
            <div className="w-20 h-20 mx-auto rounded-3xl gradient-brand-soft flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-lg font-bold mb-2">Tvoj feed je zatiaľ prázdny</h2>
            <p className="text-muted-foreground text-sm mb-4">Začni sledovať ľudí alebo pridaj prvý príspevok.</p>
            <Link to="/search" className="inline-block px-6 py-2.5 rounded-full gradient-brand text-primary-foreground font-semibold shadow-brand">
              Nájsť ľudí
            </Link>
          </div>
        )}

        {posts.map((p) => (
          <PostCard key={p.id} post={p} onChange={() => fetchPage(0, true)} />
        ))}

        <div ref={sentinelRef} className="h-10" />
        {hasMore && posts.length > 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground">Načítavam…</div>
        )}
      </div>
    </div>
  );
}
