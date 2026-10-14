import React, { useState } from 'react';
import {
  X,
  Database,
  KeyRound,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Star,
} from 'lucide-react';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  isSupabaseReady,
} from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ isOpen, onClose }) => {
  const { recheckConfig } = useAuth();
  const { success, error } = useToast();

  const creds = getSupabaseCredentials();
  const [url, setUrl] = useState(creds.url);
  const [anonKey, setAnonKey] = useState(creds.anonKey);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const isConfigured = isSupabaseReady();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (!url.trim().startsWith('https://')) {
        error('Supabase URL must start with https://');
        setIsSaving(false);
        return;
      }
      if (anonKey.trim().length < 20) {
        error('Anon key seems too short. Please verify your public anon key.');
        setIsSaving(false);
        return;
      }

      saveSupabaseCredentials(url, anonKey);
      recheckConfig();
      success('Supabase credentials saved successfully!');
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 500);
    } catch (err: any) {
      error(err?.message || 'Failed to save credentials.');
      setIsSaving(false);
    }
  };

  const copySqlToClipboard = async () => {
    const sqlScript = `-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.profiles enable row level security;
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- 2. Follows Table
create table if not exists public.follows (
  follower_id uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (follower_id, following_id),
  constraint cannot_follow_self check (follower_id != following_id)
);
alter table public.follows enable row level security;
drop policy if exists "Public follows are viewable by everyone" on public.follows;
create policy "Public follows are viewable by everyone" on public.follows for select using (true);
drop policy if exists "Users can follow others" on public.follows;
create policy "Users can follow others" on public.follows for insert with check (auth.uid() = follower_id);
drop policy if exists "Users can unfollow" on public.follows;
create policy "Users can unfollow" on public.follows for delete using (auth.uid() = follower_id);

-- 3. Posts Table
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  caption text,
  media_url text,
  media_type text default 'video',
  privacy text default 'public',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.posts enable row level security;
drop policy if exists "Public posts are viewable by everyone" on public.posts;
create policy "Public posts are viewable by everyone" on public.posts for select using (true);
drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts" on public.posts for insert with check (auth.uid() = user_id);

-- 4. Comments Table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  body text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.comments enable row level security;
drop policy if exists "Comments viewable by everyone" on public.comments;
create policy "Comments viewable by everyone" on public.comments for select using (true);
drop policy if exists "Users create comments" on public.comments;
create policy "Users create comments" on public.comments for insert with check (auth.uid() = user_id);
drop policy if exists "Users delete own comments" on public.comments;
create policy "Users delete own comments" on public.comments for delete using (auth.uid() = user_id);

-- 5. Likes Table
create table if not exists public.likes (
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (post_id, user_id)
);
alter table public.likes enable row level security;
drop policy if exists "Likes viewable by everyone" on public.likes;
create policy "Likes viewable by everyone" on public.likes for select using (true);
drop policy if exists "Users can like" on public.likes;
create policy "Users can like" on public.likes for insert with check (auth.uid() = user_id);
drop policy if exists "Users can unlike" on public.likes;
create policy "Users can unlike" on public.likes for delete using (auth.uid() = user_id);

-- 6. Saved Posts Table
create table if not exists public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, post_id)
);
alter table public.saved_posts enable row level security;
drop policy if exists "Users view own saved" on public.saved_posts;
create policy "Users view own saved" on public.saved_posts for select using (auth.uid() = user_id);
drop policy if exists "Users save posts" on public.saved_posts;
create policy "Users save posts" on public.saved_posts for insert with check (auth.uid() = user_id);
drop policy if exists "Users unsave posts" on public.saved_posts;
create policy "Users unsave posts" on public.saved_posts for delete using (auth.uid() = user_id);

-- 7. Storage Buckets
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('posts', 'posts', true) on conflict (id) do update set public = true;
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
drop policy if exists "Post media is publicly accessible" on storage.objects;
create policy "Post media is publicly accessible" on storage.objects for select using (bucket_id = 'posts');
drop policy if exists "Users can upload post media" on storage.objects;
create policy "Users can upload post media" on storage.objects for insert with check (bucket_id = 'posts' and auth.role() = 'authenticated');

-- 8. Conversations & Messages
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant1_id uuid references public.profiles(id) on delete cascade not null,
  participant2_id uuid references public.profiles(id) on delete cascade not null,
  last_message text,
  last_message_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_conversation_participants unique (participant1_id, participant2_id)
);
grant all on table public.conversations to anon, authenticated, service_role;
alter table public.conversations enable row level security;
drop policy if exists "Participants view conversations" on public.conversations;
create policy "Participants view conversations" on public.conversations for select using (auth.uid() = participant1_id or auth.uid() = participant2_id);
drop policy if exists "Participants insert conversations" on public.conversations;
create policy "Participants insert conversations" on public.conversations for insert with check (auth.uid() = participant1_id or auth.uid() = participant2_id);
drop policy if exists "Participants update conversations" on public.conversations;
create policy "Participants update conversations" on public.conversations for update using (auth.uid() = participant1_id or auth.uid() = participant2_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint message_body_not_empty check (char_length(trim(body)) > 0)
);
grant all on table public.messages to anon, authenticated, service_role;
alter table public.messages enable row level security;
drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages" on public.messages for select using (exists (select 1 from public.conversations c where c.id = messages.conversation_id and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())));
drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages for insert with check (auth.uid() = sender_id and exists (select 1 from public.conversations c where c.id = messages.conversation_id and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())));

create or replace function public.handle_new_message() returns trigger as $$
begin
  update public.conversations set last_message = new.body, last_message_at = new.created_at, updated_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists on_message_created on public.messages;
create trigger on_message_created after insert on public.messages for each row execute function public.handle_new_message();

alter table public.conversations replica identity full;
alter table public.messages replica identity full;

do $$ begin
  begin alter publication supabase_realtime add table public.conversations; exception when others then null; end;
  begin alter publication supabase_realtime add table public.messages; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';`;

    try {
      await navigator.clipboard.writeText(sqlScript);
      setCopiedSql(true);
      success('SQL schema copied to clipboard! Paste it into Supabase SQL Editor.');
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      error('Could not copy SQL automatically.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="icon-badge">
              <Database size={20} className="text-gold" />
            </div>
            <div>
              <h3>Supabase Backend Setup</h3>
              <p className="modal-subtitle">Connect Brighter to your real PostgreSQL database & Auth</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Status Banner */}
          <div className={`status-pill ${isConfigured ? 'status-connected' : 'status-pending'}`}>
            <div className="status-indicator-dot" />
            <span>
              {isConfigured
                ? 'Supabase Client Connected & Operational'
                : 'Awaiting Supabase Credentials'}
            </span>
          </div>

          <form onSubmit={handleSave} className="form-stack">
            <div className="input-group">
              <label htmlFor="supabase-url">
                <Database size={15} /> Supabase Project URL
              </label>
              <input
                id="supabase-url"
                type="url"
                placeholder="https://xyzcompany.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="input-field"
              />
              <span className="input-hint">
                Found in: Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project URL
              </span>
            </div>

            <div className="input-group">
              <label htmlFor="supabase-anon">
                <KeyRound size={15} /> Project Anon (Public) Key
              </label>
              <input
                id="supabase-anon"
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                required
                className="input-field"
              />
              <span className="input-hint">
                Safe for frontend. Found in: Project Settings &rarr; API &rarr; Project API keys (anon public)
              </span>
            </div>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={copySqlToClipboard}
              >
                {copiedSql ? <Check size={16} /> : <Copy size={16} />}
                {copiedSql ? 'Copied SQL!' : 'Copy SQL Schema'}
              </button>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <ExternalLink size={15} /> Open Supabase
              </a>
              <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving}>
                <Star size={16} />
                {isSaving ? 'Connecting...' : 'Save & Connect'}
              </button>
            </div>
          </form>

          {/* Setup Instructions */}
          <div className="setup-guide-box">
            <h4>
              <ShieldCheck size={16} className="text-gold" /> Quick 2-Minute Setup Checklist
            </h4>
            <ol className="setup-steps">
              <li>
                Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>.
              </li>
              <li>
                Navigate to <strong>SQL Editor</strong> &rarr; Click <strong>New Query</strong> &rarr; Run the provided schema in <code>supabase_schema.sql</code>.
              </li>
              <li>
                In <strong>Authentication &rarr; Providers &rarr; Email</strong>, ensure Email provider is enabled. (Optional: Disable "Confirm email" for instant login during testing).
              </li>
              <li>
                Paste your Project URL &amp; Anon Key above or save them in a <code>.env</code> file.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
