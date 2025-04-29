-- 1. First drop any existing policies on the recordings table
DROP POLICY IF EXISTS "Users can view their own recordings" ON recordings;
DROP POLICY IF EXISTS "Users can insert their own recordings" ON recordings;
DROP POLICY IF EXISTS "Users can update their own recordings" ON recordings;
DROP POLICY IF EXISTS "Users can delete their own recordings" ON recordings;

-- 2. Make sure RLS is enabled on the recordings table
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- 3. Create new policies for recordings table
-- Policy for selecting records - allow users to view only their own recordings
CREATE POLICY "Users can view their own recordings" 
ON recordings 
FOR SELECT 
USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- Policy for inserting records - only allow users to insert recordings associated with their profile
CREATE POLICY "Users can insert their own recordings" 
ON recordings 
FOR INSERT 
WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Policy for updating records - allow users to update only their own recordings
CREATE POLICY "Users can update their own recordings" 
ON recordings 
FOR UPDATE 
USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- Policy for deleting records - allow users to delete only their own recordings
CREATE POLICY "Users can delete their own recordings" 
ON recordings 
FOR DELETE 
USING (auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id));

-- 4. Add explanatory comment
COMMENT ON TABLE recordings IS 'Table storing user recordings with policies allowing users to manage only their own recordings'; 