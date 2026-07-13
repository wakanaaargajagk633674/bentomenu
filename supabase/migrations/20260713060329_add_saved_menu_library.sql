create table public.saved_menus (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind public.menu_kind not null,
  source_id text not null,
  name text not null,
  cuisine text not null,
  tagline text,
  price_yen integer not null check (price_yen >= 0),
  payload jsonb not null,
  schema_version integer not null default 1,
  image_status text not null default 'pending' check (image_status in ('pending', 'ready', 'failed')),
  image_path text,
  image_alt text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, kind, source_id)
);

create index saved_menus_owner_created_idx
  on public.saved_menus(owner_id, created_at desc);
create index saved_menus_owner_kind_idx
  on public.saved_menus(owner_id, kind, created_at desc);

alter table public.saved_menus enable row level security;

create policy "users read own saved menus"
  on public.saved_menus for select
  using (owner_id = auth.uid());

create policy "users create own saved menus"
  on public.saved_menus for insert
  with check (owner_id = auth.uid());

create policy "users delete own saved menus"
  on public.saved_menus for delete
  using (owner_id = auth.uid());

create policy "users update own saved menus"
  on public.saved_menus for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant select, insert, update, delete on public.saved_menus to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'saved-menu-images',
  'saved-menu-images',
  false,
  10485760,
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "users read own saved menu images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'saved-menu-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users upload own saved menu images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'saved-menu-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own saved menu images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'saved-menu-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
