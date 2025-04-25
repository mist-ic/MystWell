-- Migration to simplify the RLS SELECT policy for recordings

-- 1. Ensure the helper function exists and uses SECURITY DEFINER
--    This function securely gets the profile ID of the currently authenticated user.
--    SECURITY DEFINER is important so it can query 'profiles' even if the user's
--    role doesn't have direct SELECT permission granted via RLS on 'profiles'.
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
-- Set a secure search path: Schema is owned by postgres, postgres has permissions on auth.uid()
-- It is a SECURITY DEFINER function, so it runs as the function owner (postgres)
-- The function owner (postgres) should have appropriate permissions.
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Drop the potentially problematic existing SELECT policy
--    (Adjust the name if it was different in your initial setup)
DROP POLICY IF EXISTS "Users can view their own recordings" ON public.recordings;

-- 3. Create the new, simplified SELECT policy
--    This policy allows users to select recordings where the recording's profile_id
--    matches the profile_id returned by the secure helper function.
CREATE POLICY "Users can view their own recordings"
ON public.recordings
FOR SELECT
USING (profile_id = public.get_my_profile_id());

-- Optional: Re-grant SELECT permissions if they were somehow removed or managed per-policy
-- GRANT SELECT ON public.recordings TO authenticated;

COMMENT ON POLICY "Users can view their own recordings" ON public.recordings IS 'Users can view recordings linked to their own profile ID, determined via get_my_profile_id().';

-- Note: Make sure RLS is still enabled on the table (should be from previous migrations)
-- ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY; -- Usually already enabled 