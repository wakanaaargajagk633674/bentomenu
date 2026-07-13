create policy "users update own saved menu images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'saved-menu-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'saved-menu-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
