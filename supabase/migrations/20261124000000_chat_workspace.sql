create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  primary_employee_id uuid references public.client_employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_employees (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  employee_id uuid not null references public.client_employees(id) on delete cascade,
  primary key (conversation_id, employee_id)
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender text not null check (sender in ('client', 'agent', 'system')),
  employee_id uuid references public.client_employees(id),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.conversation_employees enable row level security;
alter table public.conversation_messages enable row level security;

create policy "Own conversations"
on public.conversations for all to authenticated
using (client_id = auth.uid())
with check (client_id = auth.uid());

create policy "Own conversation agents"
on public.conversation_employees for all to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.client_id = auth.uid()
  )
  and exists (
    select 1 from public.client_employees e
    where e.id = employee_id
      and e.client_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.client_id = auth.uid()
  )
  and exists (
    select 1 from public.client_employees e
    where e.id = employee_id
      and e.client_id = auth.uid()
  )
);

create policy "Own conversation messages"
on public.conversation_messages for all to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.client_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.client_id = auth.uid()
  )
);

create index if not exists conversations_client_idx
on public.conversations(client_id);

create index if not exists messages_conversation_idx
on public.conversation_messages(conversation_id, created_at);

create or replace function public.validate_conversation_employee_ownership()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  conversation_client_id uuid;
  employee_client_id uuid;
begin
  select client_id
  into conversation_client_id
  from public.conversations
  where id = coalesce(
    case when tg_argv[0] = 'conversation' then new.id
         else new.conversation_id
    end,
    '00000000-0000-0000-0000-000000000000'::uuid
  );

  if tg_argv[0] = 'conversation' then
    if new.primary_employee_id is not null then
      select client_id
      into employee_client_id
      from public.client_employees
      where id = new.primary_employee_id;

      if employee_client_id is null or employee_client_id != new.client_id then
        raise exception 'Primary employee must belong to the conversation client';
      end;
    end if;
  elsif new.employee_id is not null then
    select client_id
    into employee_client_id
    from public.client_employees
    where id = new.employee_id;

    if employee_client_id is null or employee_client_id != conversation_client_id then
      raise exception 'Message employee must belong to the conversation client';
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_conversation_primary_employee on public.conversations;
create trigger validate_conversation_primary_employee
before insert or update of primary_employee_id on public.conversations
for each row execute function public.validate_conversation_employee_ownership('conversation');

drop trigger if exists validate_message_employee on public.conversation_messages;
create trigger validate_message_employee
before insert or update of employee_id on public.conversation_messages
for each row execute function public.validate_conversation_employee_ownership('message');
