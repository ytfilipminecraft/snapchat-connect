import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { Avatar } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ReportDialog } from "./ReportDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type FeedPost = {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  profile: {
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
};

export function PostCard({ post, onChange }: { post: FeedPost; onChange?: () => void }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [count, setCount] = useState(post.likes_count);
  const [burst, setBurst] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setCount((c) => c - 1);
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      setLiked(true);
      setCount((c) => c + 1);
      setBurst(true);
      setTimeout(() => setBurst(false), 800);
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      if (post.user_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          actor_id: user.id,
          type: "like",
          post_id: post.id,
        });
      }
    }
  };

  const onDoubleTap = () => {
    if (!liked) toggleLike();
    else {
      setBurst(true);
      setTimeout(() => setBurst(false), 800);
    }
  };

  const handleDelete = async () => {
    await supabase.from("posts").delete().eq("id", post.id);
    toast.success("Príspevok odstránený");
    onChange?.();
  };

  const isOwner = user?.id === post.user_id;

  return (
    <article className="hairline-b pb-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link to={`/u/${post.profile.username}`} className="flex items-center gap-3">
          <Avatar src={post.profile.avatar_url} alt={post.profile.username} size={36} />
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm">{post.profile.username}</span>
            {post.profile.is_verified && <VerifiedBadge />}
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="p-2 -mr-2 text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="w-5 h-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner ? (
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive">
                Odstrániť príspevok
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setReportOpen(true)} className="text-destructive">
                Nahlásiť
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Image */}
      <div className="relative bg-muted aspect-square w-full overflow-hidden" onDoubleClick={onDoubleTap}>
        <img src={post.image_url} alt={post.caption ?? ""} className="w-full h-full object-cover" loading="lazy" />
        {burst && (
          <Heart
            className="absolute top-1/2 left-1/2 w-32 h-32 fill-like text-like animate-heart-burst"
            style={{ transform: "translate(-50%, -50%)" }}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-4 pt-3">
        <button onClick={toggleLike} className={cn("transition-transform", liked && "animate-heart-pop")} aria-label="Lajk">
          <Heart className={cn("w-6 h-6", liked ? "fill-like text-like" : "text-foreground")} strokeWidth={1.75} />
        </button>
        <button onClick={() => setCommentsOpen(true)} className="text-foreground" aria-label="Komentáre">
          <MessageCircle className="w-6 h-6" strokeWidth={1.75} />
        </button>
      </div>

      {/* Counts */}
      <div className="px-4 pt-2 space-y-1">
        <p className="text-sm font-semibold">{count} {count === 1 ? "lajk" : count < 5 ? "lajky" : "lajkov"}</p>
        {post.caption && (
          <p className="text-sm">
            <Link to={`/u/${post.profile.username}`} className="font-semibold mr-2">{post.profile.username}</Link>
            {post.caption}
          </p>
        )}
        {post.comments_count > 0 && (
          <button onClick={() => setCommentsOpen(true)} className="text-sm text-muted-foreground">
            Zobraziť všetky komentáre ({post.comments_count})
          </button>
        )}
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground pt-1">{timeAgo(post.created_at)}</p>
      </div>

      <CommentsSheet
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postId={post.id}
        postOwnerId={post.user_id}
        onChange={onChange}
      />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="post"
        targetId={post.id}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odstrániť príspevok?</AlertDialogTitle>
            <AlertDialogDescription>Túto akciu nie je možné vrátiť späť.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Odstrániť
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function CommentsSheet({
  open,
  onClose,
  postId,
  postOwnerId,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  postOwnerId: string;
  onChange?: () => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<
    { id: string; content: string; created_at: string; user_id: string; profile: { username: string; avatar_url: string | null } }[]
  >([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, profile:profiles!comments_user_id_fkey(username, avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      setComments((data as any) ?? []);
    })();
  }, [open, postId]);

  const submit = async () => {
    if (!user || !text.trim()) return;
    setLoading(true);
    const content = text.trim().slice(0, 500);
    const { data } = await supabase
      .from("comments")
      .insert({ post_id: postId, user_id: user.id, content })
      .select("id, content, created_at, user_id, profile:profiles!comments_user_id_fkey(username, avatar_url)")
      .single();
    if (data) setComments((c) => [...c, data as any]);
    setText("");
    setLoading(false);
    if (postOwnerId !== user.id) {
      await supabase.from("notifications").insert({
        user_id: postOwnerId,
        actor_id: user.id,
        type: "comment",
        post_id: postId,
      });
    }
    onChange?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[80vh] flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Komentáre</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Buď prvý kto komentuje 💬</p>}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar src={c.profile?.avatar_url} alt={c.profile?.username} size={32} />
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-semibold mr-2">{c.profile?.username}</span>
                  {c.content}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(c.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t flex gap-2">
          <Input
            placeholder="Napíš komentár…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button onClick={submit} disabled={loading || !text.trim()} size="icon" className="gradient-brand text-primary-foreground">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
