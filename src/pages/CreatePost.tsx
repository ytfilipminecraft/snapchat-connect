import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cropper from "react-easy-crop";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "none", label: "Originál", css: "" },
  { key: "bw", label: "Čierno-biely", css: "grayscale(100%)" },
  { key: "sepia", label: "Sépia", css: "sepia(80%)" },
  { key: "vintage", label: "Vintage", css: "sepia(40%) contrast(85%) brightness(105%) saturate(140%) hue-rotate(-10deg)" },
  { key: "contrast", label: "Kontrast+", css: "contrast(140%) saturate(120%)" },
];

export default function CreatePost() {
  const nav = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "crop" | "filter" | "caption">("pick");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Max 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(reader.result as string);
      setStep("crop");
    };
    reader.readAsDataURL(f);
  };

  const onCropComplete = useCallback((_a: any, p: any) => setCroppedAreaPixels(p), []);

  const cropImage = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 1080;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(
          img,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          size,
          size,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = reject;
      img.src = src!;
    });
  };

  const goFilter = async () => {
    const url = await cropImage();
    setCroppedDataUrl(url);
    setStep("filter");
  };

  const applyFilterAndUpload = async (): Promise<string> => {
    const img = new Image();
    return new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.filter = filter.css || "none";
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          async (blob) => {
            if (!blob || !user) return reject("err");
            const path = `${user.id}/${Date.now()}.jpg`;
            const { error } = await supabase.storage.from("posts").upload(path, blob, {
              contentType: "image/jpeg",
            });
            if (error) return reject(error);
            const { data } = supabase.storage.from("posts").getPublicUrl(path);
            resolve(data.publicUrl);
          },
          "image/jpeg",
          0.9,
        );
      };
      img.onerror = reject;
      img.src = croppedDataUrl!;
    });
  };

  const submit = async () => {
    if (!user || !croppedDataUrl) return;
    setSubmitting(true);
    try {
      const url = await applyFilterAndUpload();
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        image_url: url,
        caption: caption.trim().slice(0, 2200) || null,
      });
      if (error) throw error;
      toast.success("Príspevok zverejnený 🎉");
      nav("/");
    } catch (e: any) {
      toast.error(e.message ?? "Niečo sa pokazilo");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass safe-top">
        <div className="flex items-center justify-between px-2 h-14">
          <button
            onClick={() => {
              if (step === "pick") nav(-1);
              else if (step === "crop") setStep("pick");
              else if (step === "filter") setStep("crop");
              else setStep("filter");
            }}
            className="p-2 text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">
            {step === "pick" && "Nový príspevok"}
            {step === "crop" && "Orežte"}
            {step === "filter" && "Filter"}
            {step === "caption" && "Popis"}
          </h1>
          {step === "crop" && croppedAreaPixels ? (
            <button onClick={goFilter} className="px-3 py-1.5 text-sm font-semibold text-primary">Ďalej</button>
          ) : step === "filter" ? (
            <button onClick={() => setStep("caption")} className="px-3 py-1.5 text-sm font-semibold text-primary">Ďalej</button>
          ) : step === "caption" ? (
            <button onClick={submit} disabled={submitting} className="px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Zdieľať"}
            </button>
          ) : (
            <span className="w-10" />
          )}
        </div>
      </header>

      {step === "pick" && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 rounded-3xl gradient-brand-soft flex items-center justify-center mb-4">
            <ImagePlus className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-lg font-bold mb-2">Vyber fotku</h2>
          <p className="text-sm text-muted-foreground mb-6">Z galérie alebo fotoaparátu.</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} className="gradient-brand text-primary-foreground shadow-brand h-12 px-8 rounded-full">
            Vybrať fotku
          </Button>
        </div>
      )}

      {step === "crop" && src && (
        <div className="flex-1 relative bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
      )}

      {step === "filter" && croppedDataUrl && (
        <div className="flex-1 flex flex-col">
          <div className="aspect-square w-full bg-black overflow-hidden">
            <img src={croppedDataUrl} alt="" style={{ filter: filter.css || "none" }} className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-3 overflow-x-auto p-4 no-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center gap-1.5",
                  filter.key === f.key && "scale-105",
                )}
              >
                <div
                  className={cn(
                    "w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors",
                    filter.key === f.key ? "border-primary shadow-glow" : "border-transparent",
                  )}
                >
                  <img src={croppedDataUrl} alt={f.label} style={{ filter: f.css || "none" }} className="w-full h-full object-cover" />
                </div>
                <span className={cn("text-xs", filter.key === f.key ? "text-primary font-semibold" : "text-muted-foreground")}>
                  {f.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "caption" && croppedDataUrl && (
        <div className="flex-1 p-4 space-y-4">
          <div className="flex gap-3">
            <img src={croppedDataUrl} alt="" style={{ filter: filter.css || "none" }} className="w-20 h-20 rounded-xl object-cover" />
            <Textarea
              placeholder="Napíš popisok…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={2200}
              className="flex-1 min-h-24 resize-none"
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">{caption.length}/2200</p>
        </div>
      )}
    </div>
  );
}
