import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
    nav("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">PulseChat</h1>
          <p className="text-sm text-muted-foreground">Prihlás sa do svojho účtu.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ty@email.sk" autoCapitalize="none" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Heslo</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Prihlásiť sa"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Nemáš účet?{" "}
          <Link to="/auth/register" className="text-foreground font-medium underline-offset-4 hover:underline">
            Zaregistruj sa
          </Link>
        </p>
      </div>
    </div>
  );
}
