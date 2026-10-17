create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit)
values ('singularity-inbox', 'singularity-inbox', false, 52428800)
on conflict (id) do update
set public = false, file_size_limit = 52428800;

create table if not exists public.received_files (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  client_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 52428800),
  storage_path text not null unique,
  received_at timestamptz not null default now(),
  status text not null default 'received' check (status in ('received', 'archived')),
  assigned_agent text,
  is_read boolean not null default false
);

alter table public.received_files enable row level security;
revoke all on public.received_files from anon, authenticated;
grant insert (filename, client_name, content_type, size_bytes, storage_path)
  on public.received_files to anon, authenticated;
grant select, delete on public.received_files to authenticated;
grant update (status, assigned_agent, is_read) on public.received_files to authenticated;

create policy "Anyone may deliver file metadata"
  on public.received_files for insert to anon, authenticated
  with check (status = 'received' and is_read = false and assigned_agent is null);

create policy "CEOs may read received files"
  on public.received_files for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ceo');

create policy "CEOs may update received files"
  on public.received_files for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ceo')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ceo');

create policy "CEOs may delete received files"
  on public.received_files for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ceo');

create policy "Clients may upload private files"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'singularity-inbox');

create policy "CEOs may read private files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'singularity-inbox'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'ceo'
  );

create policy "CEOs may delete private files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'singularity-inbox'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'ceo'
  );