-- Enable pgvector extension if not already enabled (likely is, but good practice)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add the vector column to the documents table
-- Assuming text-embedding-004 model dimension (768)
ALTER TABLE public.documents
ADD COLUMN embedding vector(768);

-- Create an HNSW index for efficient similarity search
-- Choose reasonable values for m and ef_construction
-- m = 16 (default), ef_construction = 64 (default)
-- Adjust based on performance testing if needed
CREATE INDEX idx_documents_embedding_hnsw ON public.documents
USING hnsw (embedding extensions.vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64); -- Add parameters if deviating from defaults
;

-- Optionally: Update RLS policy if needed? 
-- Current policy grants ALL based on profile_id ownership, which should still cover the new column.
-- No immediate change needed unless specific SELECT restrictions on embedding are desired.

-- Add a comment indicating the purpose of the column
COMMENT ON COLUMN public.documents.embedding IS 'Stores text embeddings of document content/summary for similarity search.'; 