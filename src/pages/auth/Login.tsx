import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vitaj späť!");
    nav("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute inset-0 gradient-brand-soft opacity-50 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/30 blur-[120px]" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary-glow/30 blur-[120px]" />

      <div className="relative w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl gradient-brand shadow-brand mb-2">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Vitaj v <span className="gradient-text">PulseChat</span>
          </h1>
          <p className="text-muted-foreground">Prihlás sa a pokračuj v rozhovore.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 glass rounded-3xl p-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ty@email.sk" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Heslo</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" disabled={loading} className="w-full gradient-brand text-primary-foreground hover:opacity-90 shadow-brand h-12 text-base font-semibold">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Prihlásiť sa"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Nemáš účet?{" "}
          <Link to="/auth/register" className="text-primary font-semibold hover:underline">
            Zaregistruj sa
          </Link>
        </p>
      </div>
    </div>
  );
}
