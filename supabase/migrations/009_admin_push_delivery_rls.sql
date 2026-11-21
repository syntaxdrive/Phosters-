-- Phosters Phase 4.3 Follow-up Migration: Admin Push Delivery RLS
-- Run this script in your Supabase Dashboard -> SQL Editor AFTER 006_push_notifications.sql.
-- Purpose: Allow verified administrators to update last_notified_at and prune expired (404/410)
-- device subscriptions when delivering push notifications without requiring a service_role key.

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_own_or_admin" on public.push_subscriptions;
create policy "push_subscriptions_update_own_or_admin"
  on public.push_subscriptions for update to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_own_or_admin" on public.push_subscriptions;
create policy "push_subscriptions_delete_own_or_admin"
  on public.push_subscriptions for delete to authenticated
  using (auth.uid() = user_id or public.is_admin());
