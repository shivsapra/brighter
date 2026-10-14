-- ==============================================================================
-- BRIGHTER SOCIAL APP - REAL USER-TO-USER PRIVATE MESSAGING MIGRATION
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Create conversations table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant1_id uuid not null,
  participant2_id uuid not null,
  last_message text,
  last_message_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_conversation_participants unique (participant1_id, participant2_id)
);

-- Safely link foreign keys to profiles
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conversations_participant1_fkey') then
    alter table public.conversations 
      add constraint conversations_participant1_fkey 
      foreign key (participant1_id) references public.profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'conversations_participant2_fkey') then
    alter table public.conversations 
      add constraint conversations_participant2_fkey 
      foreign key (participant2_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Fast lookup indexes
create index if not exists conversations_p1_idx on public.conversations (participant1_id);
create index if not exists conversations_p2_idx on public.conversations (participant2_id);
create index if not exists conversations_last_message_at_idx on public.conversations (last_message_at desc);

-- CRITICAL: Grant table permissions to PostgREST roles so it appears in schema cache
grant all on table public.conversations to anon, authenticated, service_role;

-- Enable Row Level Security (RLS) on conversations
alter table public.conversations enable row level security;

-- RLS: Only conversation participants can view their conversations
drop policy if exists "Participants can view their conversations" on public.conversations;
create policy "Participants can view their conversations"
  on public.conversations
  for select
  using (auth.uid() = participant1_id or auth.uid() = participant2_id);

-- RLS: Authenticated users can create conversation where they are participant1 or participant2
drop policy if exists "Participants can create conversations" on public.conversations;
create policy "Participants can create conversations"
  on public.conversations
  for insert
  with check (auth.uid() = participant1_id or auth.uid() = participant2_id);

-- RLS: Participants can update their conversation (e.g., last_message, last_message_at)
drop policy if exists "Participants can update their conversations" on public.conversations;
create policy "Participants can update their conversations"
  on public.conversations
  for update
  using (auth.uid() = participant1_id or auth.uid() = participant2_id)
  with check (auth.uid() = participant1_id or auth.uid() = participant2_id);


-- 2. Create messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  sender_id uuid not null,
  body text not null,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint message_body_not_empty check (char_length(trim(body)) > 0)
);

-- Safely link foreign keys to conversations and profiles
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'messages_conversation_id_fkey') then
    alter table public.messages 
      add constraint messages_conversation_id_fkey 
      foreign key (conversation_id) references public.conversations(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_sender_id_fkey') then
    alter table public.messages 
      add constraint messages_sender_id_fkey 
      foreign key (sender_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Fast lookup indexes
create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_created_at_idx on public.messages (created_at asc);

-- CRITICAL: Grant table permissions to PostgREST roles so it appears in schema cache
grant all on table public.messages to anon, authenticated, service_role;

-- Enable Row Level Security (RLS) on messages
alter table public.messages enable row level security;

-- RLS: Only participants in the conversation can read messages
drop policy if exists "Participants can read messages in their conversations" on public.messages;
create policy "Participants can read messages in their conversations"
  on public.messages
  for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
      and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
    )
  );

-- RLS: Only sender can insert message, must be authenticated, and must be in the conversation
drop policy if exists "Participants can send messages in their conversations" on public.messages;
create policy "Participants can send messages in their conversations"
  on public.messages
  for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
      and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
    )
  );

-- Trigger to automatically update conversation last_message & timestamp on message insert
create or replace function public.handle_new_message()
returns trigger as $$
begin
  update public.conversations
  set
    last_message = new.body,
    last_message_at = new.created_at,
    updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row
  execute function public.handle_new_message();

-- Enable Realtime publication & Replica Identity for messages & conversations
alter table public.conversations replica identity full;
alter table public.messages replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.messages;
  exception when others then null;
  end;
end $$;

-- Force PostgREST schema cache reload
notify pgrst, 'reload schema';
