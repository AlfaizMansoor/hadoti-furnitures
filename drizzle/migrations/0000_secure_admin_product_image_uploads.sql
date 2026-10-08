CREATE POLICY "Administrators can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Administrators can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Administrators can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Product images can be viewed"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');