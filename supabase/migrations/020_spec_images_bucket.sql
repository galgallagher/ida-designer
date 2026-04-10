-- Create the spec-images storage bucket (public so images load in the browser)
INSERT INTO storage.buckets (id, name, public)
VALUES ('spec-images', 'spec-images', true)
ON CONFLICT (id) DO NOTHING;

-- Studio members can upload, update, and delete images inside their own studio folder.
-- The path structure is: {studio_id}/{spec_id}
CREATE POLICY "Studio members can manage spec images"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'spec-images'
  AND (storage.foldername(name))[1] = ANY (
    SELECT studio_id::text FROM studio_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'spec-images'
  AND (storage.foldername(name))[1] = ANY (
    SELECT studio_id::text FROM studio_members WHERE user_id = auth.uid()
  )
);

-- Anyone can view spec images (required for them to display in the browser)
CREATE POLICY "Public can view spec images"
ON storage.objects FOR SELECT
USING (bucket_id = 'spec-images');
