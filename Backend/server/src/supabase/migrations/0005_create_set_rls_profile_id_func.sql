-- Migration to create a wrapper function for setting the RLS session variable

-- 1. Define the wrapper function
-- This function takes the profile_id as input and uses the built-in
-- set_config() to set the session-local variable 'rls.profile_id'.
-- It's defined as VOLATILE because set_config() modifies session state.
CREATE OR REPLACE FUNCTION public.set_rls_profile_id(profile_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  -- Use the built-in set_config function.
  -- The third parameter 'true' indicates it's a session-local setting.
  PERFORM set_config('rls.profile_id', profile_id::text, true);
END;
$$;

COMMENT ON FUNCTION public.set_rls_profile_id(uuid) IS 'Sets the session-local rls.profile_id variable for RLS checks.'; 