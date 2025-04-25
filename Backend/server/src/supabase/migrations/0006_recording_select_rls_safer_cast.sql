-- Migration to make the RLS SELECT policy more robust against empty settings

-- 1. Drop the previous SELECT policy 
DROP POLICY IF EXISTS "Users can view their own recordings via session var" ON public.recordings;

-- 2. Create the new, more robust SELECT policy
--    This policy compares the recording's profile_id (uuid) directly to the
--    text value stored in the session variable 'rls.profile_id'.
--    This avoids casting the potentially empty result of current_setting to uuid.
--    We add a NULL check for safety, although profile_id shouldn't be null.
CREATE POLICY "Users can view their own recordings via session var (safe cast)"
ON public.recordings
FOR SELECT
USING (
  profile_id IS NOT NULL AND 
  profile_id::text = NULLIF(current_setting('rls.profile_id', true), '')
);

COMMENT ON POLICY "Users can view their own recordings via session var (safe cast)" ON public.recordings 
IS 'Users can view recordings linked to their own profile ID (passed via rls.profile_id session var), safely handling potential empty settings before comparison.'; 