-- Fix touch_updated_at search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Drop broad public-read policies that allow listing entire buckets.
-- Files remain readable via the public CDN URL (public buckets serve objects
-- without needing a SELECT policy on storage.objects for direct URL access).
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "Posts public read" ON storage.objects;
DROP POLICY IF EXISTS "Messages public read" ON storage.objects;
