-- Create documents table
CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    display_name text NULL,
    status text NOT NULL CHECK (status IN ('pending_upload', 'uploaded', 'queued', 'processing', 'processed', 'processing_failed', 'processing_retried')),
    detected_document_type text NULL,
    structured_data jsonb NULL,
    error_message text NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for common lookups
CREATE INDEX idx_documents_profile_id ON documents(profile_id);
CREATE INDEX idx_documents_status ON documents(status);

-- Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage (select, insert, update, delete) their own documents
CREATE POLICY "Users can manage their own documents" ON documents
    FOR ALL
    USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    WITH CHECK (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Note: The effectiveness of this RLS policy depends on the request-scoped
-- Supabase client providing the correct auth.uid() context.
-- If issues arise, fallback might involve service-level checks or service_role usage.

-- Function to update updated_at timestamp (if not already existing globally)
-- Check if trigger exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'handle_updated_at' AND tgrelid = 'documents'::regclass
    ) THEN
        CREATE TRIGGER handle_updated_at
        BEFORE UPDATE ON documents
        FOR EACH ROW
        EXECUTE FUNCTION extensions.moddatetime ('updated_at');
    END IF;
END $$; 