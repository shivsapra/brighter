-- ==============================================================================
-- BRIGHTER SOCIAL APP - DATABASE SCHEMA & SECURITY POLICIES
-- Run this in your Supabase Project's SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Create the public profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Username constraints: 3-30 characters, alphanumeric and underscore only
  constraint username_length check (char_length(username) >= 3 and char_length(username) <= 30),
  constraint username_format check (username ~* '^[a-zA-Z0-9_]+$')
);

-- 2. Create index on username for ultra-fast lookup & uniqueness verification
create index if not exists profiles_username_idx on public.profiles (lower(username));

-- 3. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 4. RLS Policies
-- Anyone can view public profiles
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles
  for select
  using (true);

-- Authenticated users can insert their own profile
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Users can only update their own profile
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 5. Trigger for updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profiles_updated on public.profiles;
create trigger on_profiles_updated
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- 6. Trigger to automatically create a profile when a new user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
declare
  meta_username text;
  meta_display_name text;
  clean_username text;
begin
  meta_username := new.raw_user_meta_data->>'username';
  meta_display_name := new.raw_user_meta_data->>'display_name';

  -- Fallback if username was not in metadata
  if meta_username is null or trim(meta_username) = '' then
    clean_username := 'user_' || substr(new.id::text, 1, 8);
  else
    clean_username := lower(trim(meta_username));
  end if;

  if meta_display_name is null or trim(meta_display_name) = '' then
    meta_display_name := clean_username;
  end if;

  insert into public.profiles (id, username, display_name, avatar_url, bio, created_at, updated_at)
  values (
    new.id,
    clean_username,
    meta_display_name,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'bio',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger on auth.users table
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. Follows System Table
create table if not exists public.follows (
  follower_id uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  primary key (follower_id, following_id),
  constraint cannot_follow_self check (follower_id != following_id)
);

create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "Public follows are viewable by everyone" on public.follows;
create policy "Public follows are viewable by everyone"
  on public.follows
  for select
  using (true);

drop policy if exists "Users can follow others" on public.follows;
create policy "Users can follow others"
  on public.follows
  for insert
  with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow" on public.follows;
create policy "Users can unfollow"
  on public.follows
  for delete
  using (auth.uid() = follower_id);

-- 8. Posts (Sparks) Table
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  caption text,
  media_url text,
  media_type text default 'video' check (media_type in ('video', 'image')),
  privacy text default 'public' check (privacy in ('public', 'friends', 'private')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists posts_user_id_idx on public.posts (user_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

drop policy if exists "Public posts are viewable by everyone" on public.posts;
create policy "Public posts are viewable by everyone"
  on public.posts
  for select
  using (true);

drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts"
  on public.posts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts"
  on public.posts
  for delete
  using (auth.uid() = user_id);

-- 9. Storage Buckets (avatars & posts)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do update set public = true;

-- Storage policies for avatars
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' 
    and auth.role() = 'authenticated'
  );

drop policy if exists "Users can update their avatar" on storage.objects;
create policy "Users can update their avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars' 
    and auth.role() = 'authenticated'
  );

drop policy if exists "Users can delete their avatar" on storage.objects;
create policy "Users can delete their avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' 
    and auth.role() = 'authenticated'
  );

-- Storage policies for posts
drop policy if exists "Post media is publicly accessible" on storage.objects;
create policy "Post media is publicly accessible"
  on storage.objects for select
  using (bucket_id = 'posts');

drop policy if exists "Users can upload post media" on storage.objects;
create policy "Users can upload post media"
  on storage.objects for insert
  with check (
    bucket_id = 'posts' 
    and auth.role() = 'authenticated'
  );

-- 10. Comments Table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  body text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists comments_post_id_idx on public.comments (post_id);
create index if not exists comments_created_at_idx on public.comments (created_at asc);

alter table public.comments enable row level security;

drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone"
  on public.comments for select
  using (true);

drop policy if exists "Authenticated users can create comments" on public.comments;
create policy "Authenticated users can create comments"
  on public.comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments"
  on public.comments for delete
  using (auth.uid() = user_id);

-- 11. Likes Table
create table if not exists public.likes (
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (post_id, user_id)
);

create index if not exists likes_post_id_idx on public.likes (post_id);
create index if not exists likes_user_id_idx on public.likes (user_id);

alter table public.likes enable row level security;

drop policy if exists "Likes are viewable by everyone" on public.likes;
create policy "Likes are viewable by everyone"
  on public.likes for select
  using (true);

drop policy if exists "Authenticated users can like posts" on public.likes;
create policy "Authenticated users can like posts"
  on public.likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unlike posts" on public.likes;
create policy "Users can unlike posts"
  on public.likes for delete
  using (auth.uid() = user_id);

-- 12. Saved Posts (Bookmarks) Table
create table if not exists public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, post_id)
);

create index if not exists saved_posts_user_id_idx on public.saved_posts (user_id);
create index if not exists saved_posts_post_id_idx on public.saved_posts (post_id);

alter table public.saved_posts enable row level security;

drop policy if exists "Users can view their own saved posts" on public.saved_posts;
create policy "Users can view their own saved posts"
  on public.saved_posts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can save posts" on public.saved_posts;
create policy "Users can save posts"
  on public.saved_posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unsave posts" on public.saved_posts;
create policy "Users can unsave posts"
  on public.saved_posts for delete
  using (auth.uid() = user_id);

-- 13. Conversations Table (1-on-1 direct messaging)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant1_id uuid references public.profiles(id) on delete cascade not null,
  participant2_id uuid references public.profiles(id) on delete cascade not null,
  last_message text,
  last_message_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint unique_conversation_participants unique (participant1_id, participant2_id),
  constraint cannot_message_self check (participant1_id != participant2_id),
  constraint participant_order check (participant1_id < participant2_id)
);

create index if not exists conversations_p1_idx on public.conversations (participant1_id);
create index if not exists conversations_p2_idx on public.conversations (participant2_id);
create index if not exists conversations_last_message_at_idx on public.conversations (last_message_at desc);

alter table public.conversations enable row level security;

drop policy if exists "Participants can view their conversations" on public.conversations;
create policy "Participants can view their conversations"
  on public.conversations
  for select
  using (auth.uid() = participant1_id or auth.uid() = participant2_id);

drop policy if exists "Participants can create conversations" on public.conversations;
create policy "Participants can create conversations"
  on public.conversations
  for insert
  with check (auth.uid() = participant1_id or auth.uid() = participant2_id);

drop policy if exists "Participants can update their conversations" on public.conversations;
create policy "Participants can update their conversations"
  on public.conversations
  for update
  using (auth.uid() = participant1_id or auth.uid() = participant2_id)
  with check (auth.uid() = participant1_id or auth.uid() = participant2_id);

-- 14. Messages Table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint message_body_not_empty check (char_length(trim(body)) > 0)
);

create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_created_at_idx on public.messages (created_at asc);

alter table public.messages enable row level security;

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


