-- 1) Fix function search_path on bump_conversation_ts
CREATE OR REPLACE FUNCTION public.bump_conversation_ts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $function$;

-- 2) Lock down SECURITY DEFINER functions: only authenticated users may execute,
--    anon and public should not be able to call them.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- handle_new_user is invoked by trigger on auth.users; no role needs EXECUTE.

REVOKE ALL ON FUNCTION public.bump_conversation_ts() FROM PUBLIC, anon, authenticated;
-- trigger-only

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
-- trigger-only

REVOKE ALL ON FUNCTION public.get_or_create_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;

-- 3) Restrict storage object listing in public buckets so users cannot enumerate
--    other users' files. Reads of a known URL still work because the buckets are public.
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Posts are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Messages are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read posts" ON storage.objects;
DROP POLICY IF EXISTS "Public read messages" ON storage.objects;

-- Owner-scoped listing only (path must start with the user's own uid folder).
CREATE POLICY "Owners can list their avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owners can list their posts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'posts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owners can list their messages"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'messages'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
