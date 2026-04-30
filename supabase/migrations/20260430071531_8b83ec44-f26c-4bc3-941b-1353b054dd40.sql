
-- 1) Privilege escalation: prevent self-granting is_verified
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_verified = (SELECT is_verified FROM public.profiles WHERE id = auth.uid())
  AND username = (SELECT username FROM public.profiles WHERE id = auth.uid())
);

-- 2) Notification spam: only allow notifications tied to real relationships
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Users insert legitimate notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = actor_id
  AND auth.uid() <> user_id
  AND (
    -- follow: actor just followed the recipient
    (type = 'follow' AND EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid() AND f.following_id = notifications.user_id
    ))
    -- like: actor liked recipient's post
    OR (type = 'like' AND post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.likes l ON l.post_id = p.id
      WHERE p.id = notifications.post_id
        AND p.user_id = notifications.user_id
        AND l.user_id = auth.uid()
    ))
    -- comment: actor commented on recipient's post
    OR (type = 'comment' AND post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.comments c ON c.post_id = p.id
      WHERE p.id = notifications.post_id
        AND p.user_id = notifications.user_id
        AND c.user_id = auth.uid()
    ))
    -- message: actor sent a message in shared conversation
    OR (type = 'message' AND conversation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = notifications.conversation_id
        AND ((c.user_a = auth.uid() AND c.user_b = notifications.user_id)
          OR (c.user_b = auth.uid() AND c.user_a = notifications.user_id))
    ))
  )
);

-- 3) Message tampering: recipients can only mark as read
DROP POLICY IF EXISTS "Recipients mark read" ON public.messages;
CREATE POLICY "Recipients mark read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
  )
  AND auth.uid() <> sender_id
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
  )
  AND auth.uid() <> sender_id
  AND read_at IS NOT NULL
  AND content     = (SELECT content     FROM public.messages WHERE id = messages.id)
  AND image_url   = (SELECT image_url   FROM public.messages WHERE id = messages.id)
  AND conversation_id = (SELECT conversation_id FROM public.messages WHERE id = messages.id)
  AND sender_id   = (SELECT sender_id   FROM public.messages WHERE id = messages.id)
);

-- 4) Make messages bucket private + participant-only read
UPDATE storage.buckets SET public = false WHERE id = 'messages';

DROP POLICY IF EXISTS "Messages public read" ON storage.objects;
DROP POLICY IF EXISTS "Messages participants read" ON storage.objects;
CREATE POLICY "Messages participants read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'messages'
  AND (
    -- own folder
    auth.uid()::text = (storage.foldername(name))[1]
    -- or any folder where caller shares a conversation with the uploader
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE ((c.user_a = auth.uid() AND c.user_b::text = (storage.foldername(name))[1])
          OR (c.user_b = auth.uid() AND c.user_a::text = (storage.foldername(name))[1]))
    )
  )
);

-- 5) Realtime: restrict channel subscriptions to authenticated users
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
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
  -- generic table broadcasts (postgres_changes) handled via table RLS
  OR realtime.topic() NOT LIKE 'conv-%'
);
