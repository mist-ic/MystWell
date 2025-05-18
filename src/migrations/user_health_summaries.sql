-- Migration script to create the user_health_summaries table
-- This table stores persistent health summaries for users, generated from their documents and chat interactions

-- Create the user_health_summaries table
CREATE TABLE IF NOT EXISTS public.user_health_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    summary_content TEXT,
    last_updated_source TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_profile_id UNIQUE (profile_id)
);

-- Create an index for faster lookups by profile_id
CREATE INDEX IF NOT EXISTS idx_user_health_summaries_profile_id ON public.user_health_summaries (profile_id);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_user_health_summaries_updated_at ON public.user_health_summaries;

-- Create the trigger
CREATE TRIGGER update_user_health_summaries_updated_at
BEFORE UPDATE ON public.user_health_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- Add RLS policies for security
ALTER TABLE public.user_health_summaries ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own health summary
CREATE POLICY select_own_health_summary ON public.user_health_summaries
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT auth.uid() FROM public.profiles p WHERE p.id = profile_id
        )
    ); 