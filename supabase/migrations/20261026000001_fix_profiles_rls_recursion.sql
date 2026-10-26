-- ====================================================================
-- Urban Scrap Database Migration: 20261026000001_fix_profiles_rls_recursion.sql
-- Description: Resolve RLS circular recursion on public.profiles and ensure
--              authenticated users can always load their own profile and role.
-- Safe, non-destructive, and idempotent to run in Supabase SQL Editor.
-- ====================================================================

-- 1. SECURE HELPER FUNCTION: is_admin()
-- Returns true if current JWT claim has role = 'service_role' or authenticated user has role = 'admin' in public.profiles.
-- Note: Direct queries in Supabase SQL Editor run under the postgres role with database-level BYPASSRLS privileges,
-- not via this function's service_role branch.
create or replace function public.is_admin()
returns boolean as $$
begin
  -- Bypass check for service_role secret key JWT
  if auth.role() = 'service_role' then
    return true;
  end if;

  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'::public.user_role
  );
end;
$$ language plpgsql security definer stable set search_path = '';

grant execute on function public.is_admin() to authenticated, anon;

-- 2. SECURE HELPER FUNCTION: is_assigned_customer_profile(uuid)
-- Allows dealers to view customer profile information only if the caller is an active verified dealer
-- and has a booking assigned to their current dealer ID for the customer.
-- Uses SECURITY DEFINER to prevent cross-table RLS recursion between profiles and bookings.
create or replace function public.is_assigned_customer_profile(target_customer_id uuid)
returns boolean as $$
begin
  if target_customer_id is null or auth.uid() is null then
    return false;
  end if;

  -- Caller must be an active verified dealer
  if not public.is_verified_dealer() then
    return false;
  end if;

  return exists (
    select 1 from public.bookings
    where customer_id = target_customer_id
      and assigned_dealer_id = public.current_dealer_id()
  );
end;
$$ language plpgsql security definer stable set search_path = '';

grant execute on function public.is_assigned_customer_profile(uuid) to authenticated;

-- 3. SPLIT PROFILES SELECT POLICIES TO ELIMINATE RECURSION
-- Ensure RLS is active on profiles
alter table public.profiles enable row level security;

-- Drop obsolete monolithic policy
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_select_dealer" on public.profiles;

-- Policy A: Every authenticated user can read their own profile directly by id.
-- PURE PRIMARY KEY CHECK: ZERO function calls, ZERO subqueries, ZERO recursion.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Policy B: Authorized administrators can view all user profiles (for operations/review).
create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- Policy C: Verified dealers can view contact profiles of customers assigned to their active bookings.
create policy "profiles_select_dealer"
  on public.profiles for select
  to authenticated
  using (public.is_assigned_customer_profile(id));

-- Ensure explicit permissions
grant select, update on public.profiles to authenticated;
grant execute on function public.is_admin() to authenticated, anon;
