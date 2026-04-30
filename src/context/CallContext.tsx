/**
 * Audio call context — manages a single active 1:1 audio call using WebRTC.
 * Signaling goes through Supabase: `calls` table for state + `call_signals` for SDP/ICE.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

type Status = "idle" | "ringing-out" | "ringing-in" | "connecting" | "in-call" | "ended";

type Peer = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type CallCtx = {
  status: Status;
  peer: Peer | null;
  callId: string | null;
  startedAt: number | null;
  muted: boolean;
  start: (peer: Peer, conversationId: string, stream?: MediaStream) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
};

const Ctx = createContext<CallCtx | undefined>(undefined);

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [peer, setPeer] = useState<Peer | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const signalChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callRowChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ------------ Cleanup ------------
  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => {
      try {
        s.track?.stop();
      } catch {}
    });
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (signalChanRef.current) {
      supabase.removeChannel(signalChanRef.current);
      signalChanRef.current = null;
    }
    if (callRowChanRef.current) {
      supabase.removeChannel(callRowChanRef.current);
      callRowChanRef.current = null;
    }
    setMuted(false);
    setStartedAt(null);
  }, []);

  const fullEnd = useCallback(
    async (markEnded: boolean) => {
      if (markEnded && callId) {
        await supabase
          .from("calls")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", callId);
      }
      cleanup();
      setStatus("ended");
      setTimeout(() => {
        setStatus("idle");
        setPeer(null);
        setCallId(null);
        setIncomingOffer(null);
      }, 1500);
    },
    [callId, cleanup],
  );

  // ------------ Signaling helpers ------------
  const sendSignal = useCallback(
    async (kind: "offer" | "answer" | "ice", payload: any, receiverId: string, cId: string) => {
      if (!user) return;
      await supabase.from("call_signals").insert({
        call_id: cId,
        sender_id: user.id,
        receiver_id: receiverId,
        kind,
        payload,
      });
    },
    [user],
  );

  // ------------ Subscribe to incoming calls (callee side) ------------
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`incoming-calls-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter: `callee_id=eq.${user.id}`,
        },
        async (payload) => {
          const c = payload.new as any;
          if (status !== "idle") return; // already busy
          // fetch caller profile
          const { data: prof } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", c.caller_id)
            .maybeSingle();
          setPeer(prof as Peer);
          setCallId(c.id);
          setStatus("ringing-in");
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, status]);

  // ------------ Build PC ------------
  const buildPc = useCallback(
    (cId: string, otherId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal("ice", e.candidate.toJSON(), otherId, cId);
      };
      pc.ontrack = (e) => {
        if (remoteAudioRef.current && e.streams[0]) {
          remoteAudioRef.current.srcObject = e.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setStatus("in-call");
          setStartedAt((s) => s ?? Date.now());
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          fullEnd(true);
        }
      };
      return pc;
    },
    [sendSignal, fullEnd],
  );

  // ------------ Start outgoing call ------------
  const start = useCallback(
    async (p: Peer, conversationId: string, stream?: MediaStream) => {
      if (!user) return;
      if (status !== "idle") {
        toast.error("Už prebieha hovor");
        return;
      }
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch {
          toast.error("Nepodarilo sa získať prístup k mikrofónu");
          return;
        }
      }
      localStreamRef.current = stream;

      const { data: row, error } = await supabase
        .from("calls")
        .insert({
          conversation_id: conversationId,
          caller_id: user.id,
          callee_id: p.id,
          status: "ringing",
        })
        .select("id")
        .single();
      if (error || !row) {
        toast.error(error?.message ?? "Nepodarilo sa začať hovor");
        cleanup();
        return;
      }
      const cId = row.id as string;
      setPeer(p);
      setCallId(cId);
      setStatus("ringing-out");

      const pc = buildPc(cId, p.id);
      pcRef.current = pc;
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));

      // listen for signals + status updates
      subscribeToCall(cId, p.id);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal("offer", offer, p.id, cId);
    },
    [user, status, buildPc, sendSignal, cleanup],
  );

  // ------------ Subscribe to signals + call row updates ------------
  const subscribeToCall = useCallback(
    (cId: string, otherId: string) => {
      // signals
      const sigCh = supabase
        .channel(`call-signals-${cId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "call_signals",
            filter: `call_id=eq.${cId}`,
          },
          async (payload) => {
            const s = payload.new as any;
            if (s.sender_id === user?.id) return;
            const pc = pcRef.current;
            if (!pc) return;
            try {
              if (s.kind === "offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(s.payload));
                const ans = await pc.createAnswer();
                await pc.setLocalDescription(ans);
                await sendSignal("answer", ans, otherId, cId);
              } else if (s.kind === "answer") {
                await pc.setRemoteDescription(new RTCSessionDescription(s.payload));
              } else if (s.kind === "ice") {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(s.payload));
                } catch {}
              }
            } catch (err) {
              console.error("signal error", err);
            }
          },
        )
        .subscribe();
      signalChanRef.current = sigCh;

      // call status
      const callCh = supabase
        .channel(`call-row-${cId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "calls",
            filter: `id=eq.${cId}`,
          },
          (payload) => {
            const row = payload.new as any;
            if (row.status === "declined") {
              toast.message("Hovor odmietnutý");
              fullEnd(false);
            } else if (row.status === "ended") {
              fullEnd(false);
            } else if (row.status === "accepted") {
              setStatus((s) => (s === "ringing-out" ? "connecting" : s));
            }
          },
        )
        .subscribe();
      callRowChanRef.current = callCh;
    },
    [user?.id, sendSignal, fullEnd],
  );

  // ------------ Pre-fetch any pending offer on accept side ------------
  useEffect(() => {
    if (status !== "ringing-in" || !callId || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("call_signals")
        .select("kind, payload, sender_id")
        .eq("call_id", callId)
        .eq("kind", "offer")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) setIncomingOffer(data.payload as unknown as RTCSessionDescriptionInit);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, callId, user]);

  // ------------ Accept ------------
  const accept = useCallback(async () => {
    if (!callId || !peer || !user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
    } catch {
      toast.error("Nepodarilo sa získať prístup k mikrofónu");
      return;
    }
    setStatus("connecting");
    await supabase
      .from("calls")
      .update({ status: "accepted", started_at: new Date().toISOString() })
      .eq("id", callId);

    const pc = buildPc(callId, peer.id);
    pcRef.current = pc;
    localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
    subscribeToCall(callId, peer.id);

    // poll for offer if it didn't arrive yet
    let offer = incomingOffer;
    if (!offer) {
      for (let i = 0; i < 30 && !offer; i++) {
        const { data } = await supabase
          .from("call_signals")
          .select("payload")
          .eq("call_id", callId)
          .eq("kind", "offer")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (data) offer = data.payload as unknown as RTCSessionDescriptionInit;
        if (!offer) await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (!offer) {
      toast.error("Hovor zlyhal");
      fullEnd(true);
      return;
    }
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const ans = await pc.createAnswer();
    await pc.setLocalDescription(ans);
    await sendSignal("answer", ans, peer.id, callId);
  }, [callId, peer, user, buildPc, subscribeToCall, sendSignal, incomingOffer, fullEnd]);

  // ------------ Decline ------------
  const decline = useCallback(async () => {
    if (!callId) return;
    await supabase.from("calls").update({ status: "declined" }).eq("id", callId);
    cleanup();
    setStatus("idle");
    setPeer(null);
    setCallId(null);
    setIncomingOffer(null);
  }, [callId, cleanup]);

  // ------------ Hangup ------------
  const hangup = useCallback(async () => {
    await fullEnd(true);
  }, [fullEnd]);

  // ------------ Mute ------------
  const toggleMute = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    if (!tracks.length) return;
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  // hidden remote audio element
  useEffect(() => {
    const a = document.createElement("audio");
    a.autoplay = true;
    a.style.display = "none";
    document.body.appendChild(a);
    remoteAudioRef.current = a;
    return () => {
      a.remove();
      remoteAudioRef.current = null;
    };
  }, []);

  const value = useMemo<CallCtx>(
    () => ({ status, peer, callId, startedAt, muted, start, accept, decline, hangup, toggleMute }),
    [status, peer, callId, startedAt, muted, start, accept, decline, hangup, toggleMute],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCall() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCall must be inside CallProvider");
  return v;
}
