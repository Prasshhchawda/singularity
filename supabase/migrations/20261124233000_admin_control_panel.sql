create extension if not exists pgcrypto with schema extensions;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.user_profiles (id, email)
select id, email
from auth.users
on conflict (id) do nothing;

create or replace function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
  set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists create_user_profile_after_signup on auth.users;
create trigger create_user_profile_after_signup
after insert or update of email on auth.users
for each row execute function public.create_user_profile();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = (select auth.uid())
      and role = 'admin'
      and not is_suspended
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select not is_suspended
    from public.user_profiles
    where id = (select auth.uid())
  ), false);
$$;

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated, service_role;

alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon, authenticated;
grant select on public.user_profiles to authenticated;
grant update (is_suspended) on public.user_profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
  on public.user_profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Admins can suspend users" on public.user_profiles;
create policy "Admins can suspend users"
  on public.user_profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Only active profiles may access their data" on public.user_profiles;
create policy "Only active profiles may access their data"
  on public.user_profiles as restrictive for select to authenticated
  using ((select public.is_active_user()));

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs(created_at desc);

alter table public.admin_audit_logs enable row level security;
revoke all on public.admin_audit_logs from anon, authenticated;
grant select, insert on public.admin_audit_logs to authenticated;

drop policy if exists "Admins can read audit logs" on public.admin_audit_logs;
create policy "Admins can read audit logs"
  on public.admin_audit_logs for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can add audit logs" on public.admin_audit_logs;
create policy "Admins can add audit logs"
  on public.admin_audit_logs for insert to authenticated
  with check (
    (select public.is_admin())
    and admin_id = (select auth.uid())
  );

create table if not exists public.ai_employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role_category text not null check (
    role_category in ('sales', 'support', 'marketing', 'finance', 'recruiting', 'analytics')
  ),
  description text not null default '',
  system_prompt text not null,
  gemini_model text not null default 'gemini-flash-latest',
  temperature real not null default 0.7 check (temperature >= 0 and temperature <= 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists ai_employees_name_lower_idx
  on public.ai_employees(lower(name));

insert into public.ai_employees (
  name, role_category, description, system_prompt, gemini_model, temperature, is_active
)
values
  ('NOVA', 'sales', 'Outbound, lead qualifying & follow-ups',
   'You are NOVA, an AI sales representative. Help with ethical outreach, lead qualification, and thoughtful follow-ups. Never claim to contact people or take actions outside this chat.',
   'gemini-flash-latest', 0.7, true),
  ('ATLAS', 'support', 'Tickets, live chat & email in 40+ languages',
   'You are ATLAS, an AI customer support specialist. Give accurate, empathetic help, ask concise clarifying questions, and do not claim to change accounts or perform actions you cannot verify.',
   'gemini-flash-latest', 0.7, true),
  ('ECHO', 'marketing', 'Posts, captions, scheduling & DMs',
   'You are ECHO, an AI social media manager. Draft platform-aware posts, captions, schedules, and replies. Do not claim to publish or send content.',
   'gemini-flash-latest', 0.7, true),
  ('LEDGER', 'finance', 'Invoices, expenses & monthly reports',
   'You are LEDGER, an AI bookkeeping assistant. Organize financial information and explain assumptions. Do not invent transactions, provide legal or tax guarantees, or claim to modify accounting systems.',
   'gemini-flash-latest', 0.5, true),
  ('SCOUT', 'recruiting', 'Sourcing, screening & interview booking',
   'You are SCOUT, an AI recruiting assistant. Help draft inclusive job descriptions, screening questions, and interview plans. Do not make hiring decisions or claim to contact candidates.',
   'gemini-flash-latest', 0.7, true),
  ('QUILL', 'marketing', 'Blogs, SEO pages, emails & ad copy',
   'You are QUILL, an AI content writer. Create original, audience-aware drafts and clearly label assumptions. Do not claim to publish or send content.',
   'gemini-flash-latest', 0.7, true),
  ('PULSE', 'analytics', 'Dashboards, forecasts & weekly insights',
   'You are PULSE, an AI data analyst. Explain calculations, distinguish observations from estimates, and never fabricate data or claim to access dashboards that were not provided.',
   'gemini-flash-latest', 0.5, true)
on conflict (lower(name)) do nothing;

alter table public.ai_employees enable row level security;
revoke all on public.ai_employees from anon, authenticated;
grant select (id, name, role_category, description, is_active, created_at)
  on public.ai_employees to anon, authenticated;
grant insert, update, delete on public.ai_employees to authenticated;

drop policy if exists "Anyone can view active AI employees" on public.ai_employees;
create policy "Anyone can view active AI employees"
  on public.ai_employees for select to anon, authenticated
  using (is_active or (select public.is_admin()));

drop policy if exists "Admins can manage AI employees" on public.ai_employees;
create policy "Admins can manage AI employees"
  on public.ai_employees for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.admin_get_ai_employees()
returns setof public.ai_employees
language sql
stable
security definer
set search_path = ''
as $$
  select e.*
  from public.ai_employees e
  where (select public.is_admin())
  order by e.created_at desc;
$$;

revoke all on function public.admin_get_ai_employees() from public, anon;
grant execute on function public.admin_get_ai_employees() to authenticated;

create table if not exists public.discovery_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  full_name text not null,
  company text not null default '',
  requested_role text not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (
    status in ('pending', 'scheduled', 'completed', 'converted', 'cancelled')
  ),
  notes text not null default '',
  meeting_url text check (meeting_url is null or meeting_url ~* '^https://'),
  meeting_link_sent_at timestamptz,
  meeting_link_sent_by uuid references auth.users(id) on delete set null,
  meeting_access_code_hash text check (
    meeting_access_code_hash is null
    or meeting_access_code_hash ~ '^[0-9a-f]{64}$'
  ),
  meeting_access_revoked_at timestamptz,
  admin_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists discovery_calls_status_created_idx
  on public.discovery_calls(status, created_at desc);
create index if not exists discovery_calls_user_id_idx
  on public.discovery_calls(user_id);
create unique index if not exists discovery_calls_access_code_hash_idx
  on public.discovery_calls(meeting_access_code_hash)
  where meeting_access_code_hash is not null;

alter table public.discovery_calls enable row level security;
revoke all on public.discovery_calls from anon, authenticated;
grant select, update, delete on public.discovery_calls to authenticated;
grant update (
  status,
  notes,
  scheduled_at,
  meeting_url,
  meeting_link_sent_at,
  meeting_link_sent_by,
  meeting_access_code_hash,
  meeting_access_revoked_at,
  admin_seen_at
) on public.discovery_calls to authenticated;

drop policy if exists "Admins can manage discovery calls" on public.discovery_calls;
create policy "Admins can manage discovery calls"
  on public.discovery_calls for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.create_discovery_call(
  p_email text,
  p_full_name text,
  p_company text,
  p_requested_role text,
  p_scheduled_at timestamptz
)
returns table (call_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(btrim(p_full_name)) not between 1 and 120
    or length(btrim(p_email)) not between 3 and 320
    or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(btrim(p_company)) > 200
    or length(btrim(p_requested_role)) not between 1 and 500
    or p_scheduled_at is null
    or p_scheduled_at < now() - interval '1 minute'
    or p_scheduled_at > now() + interval '180 days'
  then
    raise exception 'Discovery call details are invalid';
  end if;

  return query
  insert into public.discovery_calls as inserted (
    user_id,
    email,
    full_name,
    company,
    requested_role,
    scheduled_at
  )
  values (
    (select auth.uid()),
    lower(btrim(p_email)),
    btrim(p_full_name),
    btrim(p_company),
    btrim(p_requested_role),
    p_scheduled_at
  )
  returning inserted.id, inserted.created_at;
end;
$$;

revoke all on function public.create_discovery_call(text, text, text, text, timestamptz)
  from public;
grant execute on function public.create_discovery_call(text, text, text, text, timestamptz)
  to anon, authenticated;

create or replace function public.get_discovery_call_timer(p_call_id uuid)
returns table (
  call_created_at timestamptz,
  scheduled_at timestamptz,
  status text,
  seconds_until_ready integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.created_at,
    c.scheduled_at,
    c.status,
    greatest(
      0,
      120 - floor(extract(epoch from (now() - c.created_at)))::integer
    )
  from public.discovery_calls c
  where c.id = p_call_id;
$$;

revoke all on function public.get_discovery_call_timer(uuid) from public;
grant execute on function public.get_discovery_call_timer(uuid) to anon, authenticated;

create or replace function public.get_meeting_access(
  p_call_id uuid,
  p_access_code text
)
returns table (
  is_valid boolean,
  seconds_until_ready integer,
  meeting_url text,
  scheduled_at timestamptz,
  link_configured boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  call_row public.discovery_calls;
  remaining_seconds integer;
begin
  if p_access_code is null or length(p_access_code) not between 32 and 64 then
    return query select false, 0, null::text, null::timestamptz, false;
    return;
  end if;

  select c.*
  into call_row
  from public.discovery_calls c
  where c.id = p_call_id
    and c.meeting_access_code_hash = encode(
      extensions.digest(p_access_code, 'sha256'),
      'hex'
    )
    and c.meeting_access_revoked_at is null;

  if not found then
    return query select false, 0, null::text, null::timestamptz, false;
    return;
  end if;

  remaining_seconds := greatest(
    0,
    120 - floor(extract(epoch from (now() - call_row.created_at)))::integer
  );

  return query
  select
    true,
    remaining_seconds,
    case when remaining_seconds = 0 then call_row.meeting_url else null end,
    call_row.scheduled_at,
    call_row.meeting_url is not null;
end;
$$;

revoke all on function public.get_meeting_access(uuid, text) from public;
grant execute on function public.get_meeting_access(uuid, text) to anon, authenticated;

create or replace function public.get_meeting_employee_config(
  p_call_id uuid,
  p_access_code text,
  p_employee_name text
)
returns table (
  system_prompt text,
  gemini_model text,
  temperature real
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_valid boolean;
begin
  if p_access_code is null
    or p_access_code !~ '^[A-Za-z0-9_-]{43}$'
    or p_employee_name is null
    or length(btrim(p_employee_name)) not between 1 and 120 then
    return;
  end if;

  select exists (
    select 1
    from public.discovery_calls c
    where c.id = p_call_id
      and c.meeting_access_code_hash = encode(
        extensions.digest(p_access_code, 'sha256'),
        'hex'
      )
      and c.meeting_access_revoked_at is null
      and floor(extract(epoch from (now() - c.created_at))) >= 120
  )
  into access_valid;

  if not access_valid then
    return;
  end if;

  return query
  select e.system_prompt, e.gemini_model, e.temperature
  from public.ai_employees e
  where e.is_active
    and lower(e.name) = lower(btrim(p_employee_name));
end;
$$;

revoke all on function public.get_meeting_employee_config(uuid, text, text) from public;
grant execute on function public.get_meeting_employee_config(uuid, text, text) to anon, authenticated;

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  discovery_call_id uuid references public.discovery_calls(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  employee_id uuid references public.ai_employees(id) on delete set null,
  tokens_in bigint not null default 0 check (tokens_in >= 0),
  tokens_out bigint not null default 0 check (tokens_out >= 0),
  model text not null,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_created_at_idx
  on public.ai_usage_logs(created_at desc);
create index if not exists ai_usage_logs_discovery_call_idx
  on public.ai_usage_logs(discovery_call_id, created_at desc);
create index if not exists ai_usage_logs_employee_created_idx
  on public.ai_usage_logs(employee_id, created_at desc);

alter table public.ai_usage_logs enable row level security;
revoke all on public.ai_usage_logs from anon, authenticated;
grant select on public.ai_usage_logs to authenticated;

drop policy if exists "Admins can read AI usage logs" on public.ai_usage_logs;
create policy "Admins can read AI usage logs"
  on public.ai_usage_logs for select to authenticated
  using ((select public.is_admin()));

create or replace function public.record_ai_usage(
  p_call_id uuid,
  p_access_code text,
  p_employee_name text,
  p_tokens_in bigint,
  p_tokens_out bigint,
  p_model text,
  p_latency_ms integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  call_row public.discovery_calls;
  employee_uuid uuid;
  recent_request_count bigint;
begin
  if p_access_code is null or length(p_access_code) not between 32 and 64
    or p_tokens_in not between 0 and 1000000
    or p_tokens_out not between 0 and 1000000
    or length(btrim(p_employee_name)) not between 1 and 120
    or length(btrim(p_model)) not between 1 and 128
    or p_latency_ms not between 0 and 600000
  then
    raise exception 'Usage details are invalid';
  end if;

  select c.*
  into call_row
  from public.discovery_calls c
  where c.id = p_call_id
    and c.meeting_access_code_hash = encode(
      extensions.digest(p_access_code, 'sha256'),
      'hex'
    )
    and c.meeting_access_revoked_at is null;

  if not found then
    raise exception 'Meeting access is invalid';
  end if;

  select count(*)
  into recent_request_count
  from public.ai_usage_logs l
  where l.discovery_call_id = p_call_id
    and l.created_at >= now() - interval '1 minute';

  if recent_request_count >= 60 then
    raise exception 'Usage logging rate limit exceeded';
  end if;

  select e.id
  into employee_uuid
  from public.ai_employees e
  where lower(e.name) = lower(btrim(p_employee_name))
  limit 1;

  insert into public.ai_usage_logs (
    discovery_call_id,
    user_id,
    employee_id,
    tokens_in,
    tokens_out,
    model,
    latency_ms
  )
  values (
    call_row.id,
    call_row.user_id,
    employee_uuid,
    p_tokens_in,
    p_tokens_out,
    btrim(p_model),
    p_latency_ms
  );
end;
$$;

revoke all on function public.record_ai_usage(uuid, text, text, bigint, bigint, text, integer)
  from public;
grant execute on function public.record_ai_usage(uuid, text, text, bigint, bigint, text, integer)
  to anon, authenticated;

create or replace view public.admin_ai_usage_by_category
with (security_invoker = true)
as
select
  coalesce(e.role_category, 'unassigned') as role_category,
  count(l.id)::bigint as request_count,
  coalesce(sum(l.tokens_in), 0)::bigint as tokens_in,
  coalesce(sum(l.tokens_out), 0)::bigint as tokens_out,
  coalesce(
    sum(l.tokens_in + l.tokens_out)
      filter (where l.created_at >= now() - interval '24 hours'),
    0
  )::bigint as tokens_last_24h
from public.ai_usage_logs l
left join public.ai_employees e on e.id = l.employee_id
group by coalesce(e.role_category, 'unassigned');

revoke all on public.admin_ai_usage_by_category from public, anon, authenticated;
grant select on public.admin_ai_usage_by_category to authenticated;

create or replace view public.admin_inbox_storage_summary
with (security_invoker = true)
as
select
  status,
  count(*)::bigint as file_count,
  coalesce(sum(size_bytes), 0)::bigint as bytes_used
from public.received_files
group by status;

revoke all on public.admin_inbox_storage_summary from public, anon, authenticated;
grant select on public.admin_inbox_storage_summary to authenticated;

alter table public.received_files
  add column if not exists user_id uuid references auth.users(id) on delete set null;

revoke insert on public.received_files from anon, authenticated;
revoke insert (filename, client_name, content_type, size_bytes, storage_path)
  on public.received_files from anon, authenticated;
grant insert (user_id, filename, client_name, content_type, size_bytes, storage_path)
  on public.received_files to authenticated;

drop policy if exists "Anyone may deliver file metadata" on public.received_files;
drop policy if exists "Users can read their own received files" on public.received_files;
create policy "Users can read their own received files"
  on public.received_files for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Only active profiles may access received files" on public.received_files;
create policy "Only active profiles may access received files"
  on public.received_files as restrictive for all to authenticated
  using ((select public.is_active_user()))
  with check ((select public.is_active_user()));

drop policy if exists "Users can upload their own file metadata" on public.received_files;
create policy "Users can upload their own file metadata"
  on public.received_files for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'received'
    and is_read = false
    and assigned_agent is null
    and (storage_path like (select auth.uid())::text || '/%')
  );

drop policy if exists "Admins can read received file metadata" on public.received_files;
create policy "Admins can read received file metadata"
  on public.received_files for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can update received file metadata" on public.received_files;
create policy "Admins can update received file metadata"
  on public.received_files for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete received file metadata" on public.received_files;
create policy "Admins can delete received file metadata"
  on public.received_files for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can read inbox storage objects" on storage.objects;
create policy "Admins can read inbox storage objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'singularity-inbox'
    and (select public.is_admin())
  );

drop policy if exists "Clients may upload private files" on storage.objects;
drop policy if exists "Users can upload their own inbox files" on storage.objects;
create policy "Users can upload their own inbox files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'singularity-inbox'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can read their own inbox files" on storage.objects;
create policy "Users can read their own inbox files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'singularity-inbox'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Admins can delete inbox storage objects" on storage.objects;
create policy "Admins can delete inbox storage objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'singularity-inbox'
    and (select public.is_admin())
  );

drop policy if exists "Only active profiles may access inbox objects" on storage.objects;
create policy "Only active profiles may access inbox objects"
  on storage.objects as restrictive for all to authenticated
  using (
    bucket_id <> 'singularity-inbox'
    or (select public.is_active_user())
  )
  with check (
    bucket_id <> 'singularity-inbox'
    or (select public.is_active_user())
  );

alter table public.client_employees enable row level security;
grant select on public.client_employees to authenticated;
grant insert (client_id, employee_name, employee_role, status)
  on public.client_employees to authenticated;
grant delete on public.client_employees to authenticated;

drop policy if exists "Admins can view all client employees" on public.client_employees;
create policy "Admins can view all client employees"
  on public.client_employees for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can manage client employees" on public.client_employees;
create policy "Admins can manage client employees"
  on public.client_employees for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Only active profiles may access client employees" on public.client_employees;
create policy "Only active profiles may access client employees"
  on public.client_employees as restrictive for all to authenticated
  using ((select public.is_active_user()))
  with check ((select public.is_active_user()));

alter table public.conversations enable row level security;
grant select on public.conversations to authenticated;

drop policy if exists "Admins can view all conversations" on public.conversations;
create policy "Admins can view all conversations"
  on public.conversations for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Only active profiles may access conversations" on public.conversations;
create policy "Only active profiles may access conversations"
  on public.conversations as restrictive for all to authenticated
  using ((select public.is_active_user()))
  with check ((select public.is_active_user()));

alter table public.conversation_employees enable row level security;
drop policy if exists "Only active profiles may access conversation employees" on public.conversation_employees;
create policy "Only active profiles may access conversation employees"
  on public.conversation_employees as restrictive for all to authenticated
  using ((select public.is_active_user()))
  with check ((select public.is_active_user()));

alter table public.conversation_messages enable row level security;
grant select on public.conversation_messages to authenticated;

drop policy if exists "Admins can view all conversation messages" on public.conversation_messages;
create policy "Admins can view all conversation messages"
  on public.conversation_messages for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Only active profiles may access conversation messages" on public.conversation_messages;
create policy "Only active profiles may access conversation messages"
  on public.conversation_messages as restrictive for all to authenticated
  using ((select public.is_active_user()))
  with check ((select public.is_active_user()));

create or replace view public.admin_user_workspace_metrics
with (security_invoker = true)
as
with user_ids as (
  select client_id as user_id from public.client_employees
  union
  select client_id as user_id from public.conversations
  union
  select user_id from public.received_files where user_id is not null
)
select
  ids.user_id,
  (
    select count(*)
    from public.client_employees e
    where e.client_id = ids.user_id
  )::bigint as employee_count,
  (
    select count(*)
    from public.conversations c
    join public.conversation_messages m on m.conversation_id = c.id
    where c.client_id = ids.user_id
  )::bigint as message_count,
  coalesce((
    select sum(f.size_bytes)
    from public.received_files f
    where f.user_id = ids.user_id
  ), 0)::bigint as storage_bytes
from user_ids ids;

revoke all on public.admin_user_workspace_metrics from public, anon, authenticated;
grant select on public.admin_user_workspace_metrics to authenticated;

create or replace function public.audit_admin_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  row_data jsonb;
  target_id text;
begin
  actor_id := (select auth.uid());

  if actor_id is null or not (select public.is_admin()) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  if tg_table_name = 'discovery_calls'
    and tg_op = 'UPDATE'
    and (to_jsonb(new) - 'admin_seen_at') = (to_jsonb(old) - 'admin_seen_at')
  then
    return new;
  end if;

  target_id := row_data ->> 'id';
  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    actor_id,
    lower(tg_op) || '_' || tg_table_name,
    tg_table_name,
    target_id,
    jsonb_build_object('operation', lower(tg_op))
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_admin_mutation() from public, anon, authenticated;

drop trigger if exists audit_ai_employees_mutations on public.ai_employees;
create trigger audit_ai_employees_mutations
after insert or update or delete on public.ai_employees
for each row execute function public.audit_admin_mutation();

drop trigger if exists audit_discovery_call_mutations on public.discovery_calls;
create trigger audit_discovery_call_mutations
after update or delete on public.discovery_calls
for each row execute function public.audit_admin_mutation();

drop trigger if exists audit_user_profile_mutations on public.user_profiles;
create trigger audit_user_profile_mutations
after update on public.user_profiles
for each row execute function public.audit_admin_mutation();

drop trigger if exists audit_client_employee_mutations on public.client_employees;
create trigger audit_client_employee_mutations
after insert or delete on public.client_employees
for each row execute function public.audit_admin_mutation();

drop trigger if exists audit_received_file_mutations on public.received_files;
create trigger audit_received_file_mutations
after update or delete on public.received_files
for each row execute function public.audit_admin_mutation();
