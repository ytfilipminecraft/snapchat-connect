import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search as SearchIcon, BadgeCheck, BadgeMinus } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
};

export default function Admin() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, is_verified")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q.trim()) {
      const term = q.trim().slice(0, 50);
      query = query.or(`username.ilike.%${term}%,full_name.ilike.%${term}%`);
    }
    const { data } = await query;
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const toggleVerify = async (r: Row) => {
    setBusy(r.id);
    const { error } = await supabase.rpc("set_user_verified", {
      _target: r.id,
      _verified: !r.is_verified,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(r.is_verified ? "Overenie zrušené" : "Používateľ overený");
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, is_verified: !x.is_verified } : x)));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 surface hairline-b safe-top">
        <div className="flex items-center gap-2 px-2 h-14 max-w-md mx-auto">
          <button onClick={() => nav(-1)} className="p-2" aria-label="Späť">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-base">Admin</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hľadať používateľa…"
            className="pl-9 h-11"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Klikni na používateľa pre udelenie alebo zrušenie overenia.
        </p>

        {loading && <p className="text-sm text-muted-foreground py-8 text-center">Načítavam…</p>}

        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <Avatar src={r.avatar_url} alt={r.username} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-sm truncate">{r.username}</span>
                  {r.is_verified && <VerifiedBadge />}
                </div>
                {r.full_name && <p className="text-xs text-muted-foreground truncate">{r.full_name}</p>}
              </div>
              <Button
                size="sm"
                variant={r.is_verified ? "outline" : "default"}
                disabled={busy === r.id}
                onClick={() => toggleVerify(r)}
              >
                {r.is_verified ? (
                  <>
                    <BadgeMinus className="w-4 h-4 mr-1" /> Zrušiť
                  </>
                ) : (
                  <>
                    <BadgeCheck className="w-4 h-4 mr-1" /> Overiť
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
