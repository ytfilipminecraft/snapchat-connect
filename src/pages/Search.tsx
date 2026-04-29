import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export default function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, is_verified")
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => setTrending(data ?? []));
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      const term = q.trim().slice(0, 50);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, is_verified")
        .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
        .limit(20);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const list = q.trim() ? results : trending;

  return (
    <div>
      <header className="sticky top-0 z-30 glass safe-top px-4 py-3">
        <div className="relative max-w-md mx-auto">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Vyhľadaj používateľa…"
            className="pl-9 h-11 rounded-full bg-secondary border-0"
          />
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-4">
        {!q.trim() && <h2 className="text-sm font-semibold text-muted-foreground mb-3">Objav nových ľudí</h2>}
        <div className="space-y-2">
          {list.map((u) => (
            <Link
              key={u.id}
              to={`/u/${u.username}`}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <Avatar src={u.avatar_url} alt={u.username} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-sm truncate">{u.username}</span>
                  {u.is_verified && <VerifiedBadge />}
                </div>
                {u.full_name && <p className="text-xs text-muted-foreground truncate">{u.full_name}</p>}
              </div>
            </Link>
          ))}
          {q.trim() && results.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-12">Nikoho sme nenašli.</p>
          )}
        </div>
      </div>
    </div>
  );
}
