-- Migration to modify RLS SELECT policy for recordings to use a session variable

-- 1. Drop the previous SELECT policy that used the problematic function
DROP POLICY IF EXISTS "Users can view their own recordings" ON public.recordings;

-- 2. Create the new SELECT policy
--    This policy allows users to select recordings where the recording's profile_id
--    matches a temporary session variable 'rls.profile_id' set by the backend.
--    The 'true' argument in current_setting means it won't error if the setting is missing,
--    though our backend logic should always set it before querying.
CREATE POLICY "Users can view their own recordings via session var"
ON public.recordings
FOR SELECT
USING (profile_id = current_setting('rls.profile_id', true)::uuid);

COMMENT ON POLICY "Users can view their own recordings via session var" ON public.recordings 
IS 'Users can view recordings linked to their own profile ID, which is passed via the rls.profile_id session variable set by the backend.';

-- Note: RLS should still be enabled on the table.
-- ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY; 