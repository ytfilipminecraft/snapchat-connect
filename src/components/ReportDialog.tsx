import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const REASONS = [
  { value: "inappropriate", label: "Nevhodný obsah" },
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Obťažovanie" },
  { value: "other", label: "Iné" },
] as const;

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetType: "post" | "profile";
  targetId: string;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<typeof REASONS[number]["value"]>("inappropriate");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim().slice(0, 500) || null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ďakujeme. Nahlásenie sme prijali.");
    onOpenChange(false);
    setDetails("");
    setReason("inappropriate");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nahlásiť {targetType === "post" ? "príspevok" : "profil"}</DialogTitle>
          <DialogDescription>Vyber dôvod. Pomáhaš nám udržiavať komunitu bezpečnú.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as any)} className="space-y-2">
          {REASONS.map((r) => (
            <div key={r.value} className="flex items-center space-x-2">
              <RadioGroupItem value={r.value} id={r.value} />
              <Label htmlFor={r.value} className="cursor-pointer">{r.label}</Label>
            </div>
          ))}
        </RadioGroup>
        <Textarea
          placeholder="Voliteľné podrobnosti…"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={500}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Zrušiť</Button>
          <Button onClick={submit} disabled={loading} className="gradient-brand text-primary-foreground">
            Odoslať
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
