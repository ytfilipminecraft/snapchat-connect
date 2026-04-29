import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Grid3x3, LogOut, MoreHorizontal, Settings } from "lucide-react";
import { ReportDialog } from "@/components/ReportDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Profile({ self = false }: { self?: boolean }) {
  const { username } = useParams<{ username: string }>();
  const { user, profile: myProfile, signOut } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 });
  const [iFollow, setIFollow] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const targetUsername = self ? myProfile?.username : username;
  const isMe = !!profile && profile.id === user?.id;

  const load = async () => {
    if (!targetUsername) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", targetUsername)
      .maybeSingle();
    if (!p) return;
    setProfile(p);

    const [{ data: ps }, { count: followers }, { count: following }, { data: imF }] = await Promise.all([
      supabase.from("posts").select("id, image_url, created_at").eq("user_id", p.id).order("created_at", { ascending: false }),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", p.id),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", p.id),
      user
        ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", p.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setPosts(ps ?? []);
    setCounts({ posts: ps?.length ?? 0, followers: followers ?? 0, following: following ?? 0 });
    setIFollow(!!imF);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUsername, user?.id]);

  const toggleFollow = async () => {
    if (!user || !profile) return;
    if (iFollow) {
      setIFollow(false);
      setCounts((c) => ({ ...c, followers: c.followers - 1 }));
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
    } else {
      setIFollow(true);
      setCounts((c) => ({ ...c, followers: c.followers + 1 }));
      await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
      await supabase.from("notifications").insert({
        user_id: profile.id,
        actor_id: user.id,
        type: "follow",
      });
    }
  };

  const startChat = async () => {
    if (!profile) return;
    const { data, error } = await supabase.rpc("get_or_create_conversation", { other_user: profile.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    nav(`/chat/${data}`);
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    const path = `${user.id}/avatar-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("avatars").upload(path, f, { contentType: f.type, upsert: true });
    if (error) return toast.error(error.message);
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    toast.success("Avatar zmenený");
    load();
  };

  if (!profile) {
    return <div className="p-8 text-center text-muted-foreground">Načítavam…</div>;
  }

  return (
    <div>
      <header className="sticky top-0 z-30 glass safe-top">
        <div className="flex items-center justify-between px-2 h-14">
          {!self ? (
            <button onClick={() => nav(-1)} className="p-2"><ArrowLeft className="w-5 h-5" /></button>
          ) : <span className="w-10" />}
          <h1 className="font-semibold flex items-center gap-1">
            {profile.username} {profile.is_verified && <VerifiedBadge />}
          </h1>
          {isMe ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="p-2"><Settings className="w-5 h-5" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => nav("/profile/edit")}>Upraviť profil</DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut().then(() => nav("/auth/login"))} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Odhlásiť sa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger className="p-2"><MoreHorizontal className="w-5 h-5" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setReportOpen(true)} className="text-destructive">Nahlásiť</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="max-w-md mx-auto p-4">
        <div className="flex items-center gap-6">
          <button
            onClick={() => isMe && fileRef.current?.click()}
            className={cn("relative", isMe && "cursor-pointer")}
          >
            <Avatar src={profile.avatar_url} alt={profile.username} size={96} ring />
            {isMe && (
              <span className="absolute bottom-0 right-0 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                +
              </span>
            )}
          </button>
          {isMe && <input ref={fileRef} type="file" accept="image/*" onChange={onAvatar} className="hidden" />}
          <div className="flex-1 grid grid-cols-3 gap-2 text-center">
            <Stat label="príspevky" value={counts.posts} />
            <Stat label="sledovatelia" value={counts.followers} />
            <Stat label="sledujem" value={counts.following} />
          </div>
        </div>

        <div className="mt-4">
          {profile.full_name && <p className="font-semibold text-sm">{profile.full_name}</p>}
          {profile.bio && <p className="text-sm whitespace-pre-line mt-1">{profile.bio}</p>}
        </div>

        <div className="mt-4 flex gap-2">
          {isMe ? (
            <Button onClick={() => nav("/profile/edit")} className="flex-1" variant="secondary">Upraviť profil</Button>
          ) : (
            <>
              <Button
                onClick={toggleFollow}
                className={cn("flex-1", !iFollow && "gradient-brand text-primary-foreground")}
                variant={iFollow ? "secondary" : "default"}
              >
                {iFollow ? "Sledujem" : "Sledovať"}
              </Button>
              <Button onClick={startChat} variant="secondary" className="flex-1">Správa</Button>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border/40 mt-2">
        <div className="flex items-center justify-center py-3 text-primary">
          <Grid3x3 className="w-5 h-5" />
        </div>
        {posts.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Zatiaľ žiadne príspevky.</p>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {posts.map((p) => (
              <Link key={p.id} to="/" className="aspect-square bg-muted overflow-hidden">
                <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="profile"
        targetId={profile.id}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-bold text-base">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
