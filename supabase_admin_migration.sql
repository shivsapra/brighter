-- ==============================================================================
-- BRIGHTER SOCIAL APP - COMPREHENSIVE ADMINISTRATOR SYSTEM MIGRATION
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Create User Roles Table (Secure Backend Role Storage)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('admin', 'moderator', 'user')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_user_role unique (user_id, role)
);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role);

-- Enable RLS on user_roles
alter table public.user_roles enable row level security;

-- Everyone can read roles to verify official status & badges
drop policy if exists "Roles are viewable by everyone" on public.user_roles;
create policy "Roles are viewable by everyone"
  on public.user_roles for select
  using (true);

-- 2. Security Definer Helper: is_admin(user_id)
create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean as $$
begin
  if check_user_id is null then
    return false;
  end if;
  return exists (
    select 1 from public.user_roles
    where user_id = check_user_id and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Only admins can modify roles
drop policy if exists "Only admins can modify roles" on public.user_roles;
create policy "Only admins can modify roles"
  on public.user_roles for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 3. Assign the Administrator Role to existing 'brighter' account
insert into public.user_roles (user_id, role)
select id, 'admin' from public.profiles
where username = 'brighter'
on conflict (user_id, role) do nothing;

-- 4. Extend Profiles Table for Safe Moderation & Suspension
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists is_suspended boolean default false not null;
alter table public.profiles add column if not exists suspension_reason text;
alter table public.profiles add column if not exists suspended_at timestamp with time zone;

-- 5. Extend Posts Table for Safe Moderation (Hide/Restore)
alter table public.posts add column if not exists is_hidden boolean default false not null;
alter table public.posts add column if not exists moderated_at timestamp with time zone;
alter table public.posts add column if not exists moderated_by uuid references public.profiles(id) on delete set null;

-- 6. Reports Table (User Content & Account Reports)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null default 'post' check (target_type in ('post', 'comment', 'user')),
  target_id uuid,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  action_taken text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Idempotently ensure all columns exist if table already existed
alter table public.reports add column if not exists target_type text default 'post';
alter table public.reports add column if not exists target_id uuid;
alter table public.reports add column if not exists details text;
alter table public.reports add column if not exists status text default 'pending';
alter table public.reports add column if not exists action_taken text;
alter table public.reports add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.reports add column if not exists reviewed_at timestamp with time zone;

create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
create index if not exists reports_created_at_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

-- Authenticated users can submit a report
drop policy if exists "Authenticated users can submit reports" on public.reports;
create policy "Authenticated users can submit reports"
  on public.reports for insert
  with check (auth.role() = 'authenticated');

-- Users can view reports they submitted OR admins can view all reports
drop policy if exists "Users view own reports or admins view all" on public.reports;
create policy "Users view own reports or admins view all"
  on public.reports for select
  using (auth.uid() = reporter_id or public.is_admin(auth.uid()));

-- Only admins can review/update reports
drop policy if exists "Only admins can update reports" on public.reports;
create policy "Only admins can update reports"
  on public.reports for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 7. Official Announcements Table (Broadcasted to Users' Feeds)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  body text not null,
  badge_tag text default 'OFFICIAL ANNOUNCEMENT' not null,
  priority text default 'normal' check (priority in ('low', 'normal', 'urgent', 'pinned')) not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists announcements_created_at_idx on public.announcements (created_at desc);
create index if not exists announcements_is_active_idx on public.announcements (is_active);

alter table public.announcements enable row level security;

-- Anyone can read active announcements
drop policy if exists "Active announcements viewable by all" on public.announcements;
create policy "Active announcements viewable by all"
  on public.announcements for select
  using (is_active = true or public.is_admin(auth.uid()));

-- Only admins can create/update/delete announcements
drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements"
  on public.announcements for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 8. Admin Security & Audit Log Table
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete cascade not null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;

-- Only admins can view audit logs
drop policy if exists "Only admins can view audit logs" on public.admin_audit_logs;
create policy "Only admins can view audit logs"
  on public.admin_audit_logs for select
  using (public.is_admin(auth.uid()));

-- Only admins can insert audit logs
drop policy if exists "Only admins can insert audit logs" on public.admin_audit_logs;
create policy "Only admins can insert audit logs"
  on public.admin_audit_logs for insert
  with check (public.is_admin(auth.uid()));

-- 9. Secure Admin RPC Functions (Bypasses regular user RLS safely)
create or replace function public.admin_toggle_user_suspension(
  target_user_id uuid,
  should_suspend boolean,
  reason text default null
)
returns boolean as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized: Only administrators can modify user suspension status.';
  end if;

  update public.profiles
  set
    is_suspended = should_suspend,
    suspension_reason = case when should_suspend then reason else null end,
    suspended_at = case when should_suspend then timezone('utc'::text, now()) else null end
  where id = target_user_id;

  -- Record audit log
  insert into public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    case when should_suspend then 'SUSPEND_USER' else 'RESTORE_USER' end,
    'user',
    target_user_id::text,
    jsonb_build_object('reason', reason)
  );

  return true;
end;
$$ language plpgsql security definer;

create or replace function public.admin_toggle_post_visibility(
  target_post_id uuid,
  should_hide boolean
)
returns boolean as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized: Only administrators can moderate posts.';
  end if;

  update public.posts
  set
    is_hidden = should_hide,
    moderated_at = timezone('utc'::text, now()),
    moderated_by = auth.uid()
  where id = target_post_id;

  -- Record audit log
  insert into public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    case when should_hide then 'HIDE_POST' else 'UNHIDE_POST' end,
    'post',
    target_post_id::text,
    jsonb_build_object('is_hidden', should_hide)
  );

  return true;
end;
$$ language plpgsql security definer;

-- 10. Post Deletion & Comment Deletion Policies for Admins
drop policy if exists "Admins can delete any post" on public.posts;
create policy "Admins can delete any post"
  on public.posts for delete
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "Admins can delete any comment" on public.comments;
create policy "Admins can delete any comment"
  on public.comments for delete
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- 11. CRITICAL: Grant table permissions to PostgREST roles
grant all on table public.user_roles to anon, authenticated, service_role;
grant all on table public.reports to anon, authenticated, service_role;
grant all on table public.announcements to anon, authenticated, service_role;
grant all on table public.admin_audit_logs to anon, authenticated, service_role;
grant execute on function public.is_admin to anon, authenticated, service_role;
grant execute on function public.admin_toggle_user_suspension to anon, authenticated, service_role;
grant execute on function public.admin_toggle_post_visibility to anon, authenticated, service_role;

-- Force PostgREST schema cache reload
notify pgrst, 'reload schema';
