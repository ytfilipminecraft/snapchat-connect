import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function EditProfile() {
  const { profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [full_name, setFullName] = useState(profile?.full_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: full_name.trim().slice(0, 60), bio: bio.trim().slice(0, 200) })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profil aktualizovaný");
    await refreshProfile();
    nav("/profile");
  };

  return (
    <div>
      <header className="sticky top-0 z-30 glass safe-top">
        <div className="flex items-center justify-between px-2 h-14">
          <button onClick={() => nav(-1)} className="p-2"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-semibold">Upraviť profil</h1>
          <button onClick={save} disabled={saving} className="px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-50">Uložiť</button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        <div>
          <Label>Meno</Label>
          <Input value={full_name} onChange={(e) => setFullName(e.target.value)} maxLength={60} className="mt-1.5" />
        </div>
        <div>
          <Label>Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} className="mt-1.5 min-h-24" />
          <p className="text-xs text-muted-foreground text-right mt-1">{bio.length}/200</p>
        </div>
        <Button onClick={save} disabled={saving} className="w-full gradient-brand text-primary-foreground">Uložiť</Button>
      </div>
    </div>
  );
}
