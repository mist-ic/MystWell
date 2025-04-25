-- Migration to revert recording SELECT RLS policy to use get_my_profile_id()

-- 1. Drop potentially existing policies from previous attempts
DROP POLICY IF EXISTS "Users can view their own recordings via session var" ON public.recordings;
DROP POLICY IF EXISTS "Users can view their own recordings via session var (safe cast)" ON public.recordings;

-- 2. Recreate the SELECT policy using the helper function
--    This policy allows users to select recordings where the recording's profile_id
--    matches the profile_id returned by the secure helper function.
--    (Note: This relies on get_my_profile_id() working correctly in the user's RLS context,
--     which was the source of the original issue when called via the standard backend client.
--     However, having this policy defined is better than the session var one if we fallback
--     to service_role in the backend service.)
CREATE POLICY "Users can view their own recordings"
ON public.recordings
FOR SELECT
USING (profile_id = public.get_my_profile_id());

COMMENT ON POLICY "Users can view their own recordings" ON public.recordings IS 'Users can view recordings linked to their own profile ID, determined via get_my_profile_id(). Intended policy, though backend service may use service_role.'; 