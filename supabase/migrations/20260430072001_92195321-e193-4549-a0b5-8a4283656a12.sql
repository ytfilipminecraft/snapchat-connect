
-- ============================================================
-- 1) ROLE SYSTEM
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Policies on user_roles
CREATE POLICY "Anyone authenticated can read roles"
ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2) ADMIN-ONLY VERIFICATION RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_user_verified(_target uuid, _verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can verify users';
  END IF;
  UPDATE public.profiles SET is_verified = _verified WHERE id = _target;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_verified(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_verified(uuid, boolean) TO authenticated;

-- ============================================================
-- 3) RELAX PROFILE UPDATE — allow editing name/bio/avatar but lock id, username, is_verified
-- ============================================================
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_verified = (SELECT is_verified FROM public.profiles WHERE id = auth.uid())
  AND username    = (SELECT username    FROM public.profiles WHERE id = auth.uid())
);

-- ============================================================
-- 4) CALLS (audio 1:1)
-- ============================================================
CREATE TYPE public.call_status AS ENUM ('ringing', 'accepted', 'declined', 'ended', 'missed');

CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  status public.call_status NOT NULL DEFAULT 'ringing',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calls_callee_status ON public.calls(callee_id, status);
CREATE INDEX idx_calls_caller_status ON public.calls(caller_id, status);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view calls"
ON public.calls FOR SELECT TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Caller creates call"
ON public.calls FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = caller_id
  AND caller_id <> callee_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND ((c.user_a = caller_id AND c.user_b = callee_id)
        OR (c.user_b = caller_id AND c.user_a = callee_id))
  )
);

CREATE POLICY "Participants update call"
ON public.calls FOR UPDATE TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id)
WITH CHECK (
  auth.uid() = caller_id OR auth.uid() = callee_id
);

-- ============================================================
-- 5) CALL SIGNALS (WebRTC offer/answer/ICE)
-- ============================================================
CREATE TABLE public.call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('offer', 'answer', 'ice')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_signals_call ON public.call_signals(call_id, created_at);
CREATE INDEX idx_call_signals_receiver ON public.call_signals(receiver_id, created_at);

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view call signals"
ON public.call_signals FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Participants send call signals"
ON public.call_signals FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.calls c
    WHERE c.id = call_id
      AND ((c.caller_id = sender_id AND c.callee_id = receiver_id)
        OR (c.callee_id = sender_id AND c.caller_id = receiver_id))
  )
);

-- ============================================================
-- 6) REALTIME for calls + signals
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.call_signals REPLICA IDENTITY FULL;

-- ============================================================
-- 7) Allow realtime postgres_changes subscriptions
--    (private:* topic restrictions remain in place from previous migration)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime"
ON realtime.messages FOR SELECT TO authenticated
USING (
  -- conv-<uuid>: only conversation participants
  (
    realtime.topic() LIKE 'conv-%'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = substring(realtime.topic() FROM 6)
        AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
    )
  )
  -- call-<uuid>: only call participants
  OR (
    realtime.topic() LIKE 'call-%'
    AND EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id::text = substring(realtime.topic() FROM 6)
        AND (auth.uid() = c.caller_id OR auth.uid() = c.callee_id)
    )
  )
  -- everything else (postgres_changes broadcasts) handled by table RLS
  OR (realtime.topic() NOT LIKE 'conv-%' AND realtime.topic() NOT LIKE 'call-%')
);
