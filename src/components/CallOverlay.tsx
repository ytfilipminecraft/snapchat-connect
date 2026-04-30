import { useEffect, useState } from "react";
import { useCall } from "@/context/CallContext";
import { Avatar } from "./Avatar";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function CallOverlay() {
  const { status, peer, startedAt, muted, accept, decline, hangup, toggleMute } = useCall();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status !== "in-call") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [status]);

  if (status === "idle" || !peer) return null;

  const label =
    status === "ringing-out"
      ? "Vyzváňa…"
      : status === "ringing-in"
      ? "Prichádzajúci hovor"
      : status === "connecting"
      ? "Pripájam…"
      : status === "in-call"
      ? startedAt
        ? fmt(now - startedAt)
        : "Pripojené"
      : "Hovor ukončený";

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-between safe-top safe-bottom animate-fade-in">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">{label}</p>
        <Avatar src={peer.avatar_url} alt={peer.username} size={140} />
        <h2 className="text-2xl font-semibold">{peer.username}</h2>
        {status === "in-call" && (
          <div
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-success",
              "animate-pulse",
            )}
            aria-hidden
          />
        )}
      </div>

      <div className="w-full max-w-sm px-6 pb-8 flex items-center justify-center gap-6">
        {status === "ringing-in" ? (
          <>
            <button
              onClick={decline}
              className="flex flex-col items-center gap-2"
              aria-label="Odmietnuť"
            >
              <span className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                <PhoneOff className="w-7 h-7" />
              </span>
              <span className="text-xs text-muted-foreground">Odmietnuť</span>
            </button>
            <button
              onClick={accept}
              className="flex flex-col items-center gap-2"
              aria-label="Prijať"
            >
              <span className="w-16 h-16 rounded-full bg-success text-success-foreground flex items-center justify-center">
                <Phone className="w-7 h-7" />
              </span>
              <span className="text-xs text-muted-foreground">Prijať</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className="flex flex-col items-center gap-2"
              aria-label={muted ? "Zapnúť mikrofón" : "Stlmiť"}
              disabled={status !== "in-call"}
            >
              <span
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center border border-border",
                  muted ? "bg-foreground text-background" : "bg-secondary text-foreground",
                  status !== "in-call" && "opacity-50",
                )}
              >
                {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </span>
              <span className="text-xs text-muted-foreground">{muted ? "Stlmené" : "Mikrofón"}</span>
            </button>
            <button onClick={hangup} className="flex flex-col items-center gap-2" aria-label="Ukončiť">
              <span className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                <PhoneOff className="w-7 h-7" />
              </span>
              <span className="text-xs text-muted-foreground">Ukončiť</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
