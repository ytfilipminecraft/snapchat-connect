import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("Neplatný email").max(255),
  username: z.string().trim().min(3, "Min. 3 znaky").max(20, "Max. 20 znakov").regex(/^[a-z0-9_]+$/, "Iba a-z, 0-9, _"),
  full_name: z.string().trim().min(1, "Zadaj meno").max(60),
  password: z.string().min(8, "Min. 8 znakov").max(72),
});

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", username: "", full_name: "", password: "" });
  const [loading, setLoading] = useState(false);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          username: parsed.data.username.toLowerCase(),
          full_name: parsed.data.full_name,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Účet vytvorený! Vitaj v PulseChat 🎉");
    nav("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/30 blur-[120px]" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary-glow/30 blur-[120px]" />

      <div className="relative w-full max-w-sm space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl gradient-brand shadow-brand mb-2">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Pridaj sa k <span className="gradient-text">PulseChat</span></h1>
          <p className="text-muted-foreground text-sm">Zadarmo. Bez reklám. Pre teba a tvoju partiu.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 glass rounded-3xl p-6">
          <div className="space-y-2">
            <Label htmlFor="full_name">Meno</Label>
            <Input id="full_name" required value={form.full_name} onChange={update("full_name")} placeholder="Tvoje meno" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Používateľské meno</Label>
            <Input id="username" required value={form.username} onChange={update("username")} placeholder="napr. lucia_22" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={form.email} onChange={update("email")} placeholder="ty@email.sk" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Heslo</Label>
            <Input id="password" type="password" required value={form.password} onChange={update("password")} placeholder="Min. 8 znakov" />
          </div>
          <Button type="submit" disabled={loading} className="w-full gradient-brand text-primary-foreground hover:opacity-90 shadow-brand h-12 text-base font-semibold">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Vytvoriť účet"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Už máš účet?{" "}
          <Link to="/auth/login" className="text-primary font-semibold hover:underline">Prihlás sa</Link>
        </p>
      </div>
    </div>
  );
}
