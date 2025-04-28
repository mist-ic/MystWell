-- Migration to create a function for matching documents based on vector similarity

-- Ensure vector extension is enabled (redundant but safe)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Function definition
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(768), -- Type must match the column's vector dimension
  query_profile_id uuid,
  match_threshold float, -- Cosine similarity threshold (e.g., 0.78)
  match_count int -- Max number of documents to return
)
RETURNS TABLE (
  id uuid,
  header_description text,
  similarity float
)
LANGUAGE sql STABLE -- Function doesn't modify the database, STABLE is appropriate
AS $$
  SELECT
    doc.id,
    doc.structured_data->>'headerDescription' AS header_description, -- Extract headerDescription from JSONB
    1 - (doc.embedding <=> query_embedding) AS similarity -- Cosine distance is 0 for identical, 1 for opposite. Similarity = 1 - distance.
  FROM public.documents AS doc
  WHERE doc.profile_id = query_profile_id -- Filter by the user's profile
    AND 1 - (doc.embedding <=> query_embedding) > match_threshold -- Apply the similarity threshold
  ORDER BY similarity DESC -- Order by similarity (highest first)
  LIMIT match_count; -- Limit the number of results
$$;

-- Add comment to the function
COMMENT ON FUNCTION match_documents(vector, uuid, float, int) IS 'Searches for documents relevant to a query embedding using cosine similarity, filtering by profile ID.'; 