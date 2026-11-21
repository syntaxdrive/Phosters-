-- Phosters Phase 4.3 Migration: Native Web Push Notifications
-- Run this script in your Supabase Dashboard -> SQL Editor AFTER 001 - 005.

-- 1. Student & admin browser push subscriptions (one row per installed device/browser)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  notify_lessons boolean not null default true,
  notify_tests boolean not null default true,
  notify_broadcasts boolean not null default true,
  notify_reminders boolean not null default true,
  last_notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id);

create index if not exists idx_push_subscriptions_last_notified
  on public.push_subscriptions (last_notified_at);

drop trigger if exists trg_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trg_push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row
  execute function public.set_updated_at();

-- 2. Delivery log for admin visibility and automated reminder cooldowns
create table if not exists public.push_notification_logs (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null check (
    notification_type in (
      'lesson',
      'test',
      'broadcast',
      'inactivity_reminder',
      'test_reminder',
      'custom'
    )
  ),
  title text not null check (char_length(trim(title)) >= 1 and char_length(title) <= 160),
  body text not null check (char_length(trim(body)) >= 1 and char_length(body) <= 500),
  target_url text not null default '/app' check (target_url ~ '^/'),
  sent_by uuid null references public.profiles(id) on delete set null,
  recipients_count integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_notification_logs_created
  on public.push_notification_logs (created_at desc);

-- 3. Row Level Security Policies
alter table public.push_subscriptions enable row level security;
alter table public.push_notification_logs enable row level security;

drop policy if exists "push_subscriptions_select_own_or_admin" on public.push_subscriptions;
create policy "push_subscriptions_select_own_or_admin"
  on public.push_subscriptions for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "push_notification_logs_admin_all" on public.push_notification_logs;
create policy "push_notification_logs_admin_all"
  on public.push_notification_logs for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
