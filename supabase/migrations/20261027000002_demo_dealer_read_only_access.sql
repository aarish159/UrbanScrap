-- ====================================================================
-- Urban Scrap Database Migration: 20261027000002_demo_dealer_read_only_access.sql
-- Description: Implement secure, read-only demo dealer role and data stream:
--   1. Add is_demo flag to public.profiles and public.dealers
--   2. Add constraint preventing demo dealers from being marked as verified
--   3. Secure helper function is_demo_dealer()
--   4. Hardened profile and dealer update validation functions to protect is_demo
--   5. Narrowly scoped RPC get_demo_dealer_bookings() returning only
--      sanitized, non-sensitive columns of real customer bookings
--   6. Storage photo access helper restricting demo dealers by default
-- Safe, non-destructive, and idempotent to run in Supabase SQL Editor.
-- ====================================================================

-- 1. ADD IS_DEMO COLUMN TO PROFILES AND DEALERS
alter table public.profiles
  add column if not exists is_demo boolean not null default false;

alter table public.dealers
  add column if not exists is_demo boolean not null default false;

create index if not exists idx_profiles_is_demo on public.profiles(is_demo);
create index if not exists idx_dealers_is_demo on public.dealers(is_demo);

-- 2. ENFORCE AT DATABASE LEVEL: DEMO DEALER CANNOT BE MARKED AS VERIFIED
alter table public.dealers drop constraint if exists chk_dealers_demo_not_verified;
alter table public.dealers add constraint chk_dealers_demo_not_verified
  check (not (is_demo = true and is_verified = true));

-- 3. SECURE HELPER FUNCTION: is_demo_dealer()
create or replace function public.is_demo_dealer()
returns boolean as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  return exists (
    select 1 from public.dealers d
    where d.user_id = auth.uid() and d.is_demo = true
  ) or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_demo = true
  );
end;
$$ language plpgsql security definer stable set search_path = '';

grant execute on function public.is_demo_dealer() to authenticated, anon;

-- 4. HARDEN PROFILE UPDATE VALIDATION: PROTECT is_demo FROM TAMPERING
create or replace function public.is_valid_profile_update(p public.profiles)
returns boolean as $$
declare
  old_p public.profiles;
begin
  select * into old_p
  from public.profiles
  where id = p.id;

  if not found then
    return false;
  end if;

  -- Caller can only update their own profile
  if old_p.id != auth.uid() or p.id != auth.uid() then
    return false;
  end if;

  -- Non-admin cannot alter role or is_demo status
  return (
    old_p.role = p.role
    and old_p.is_demo is not distinct from p.is_demo
  );
end;
$$ language plpgsql security definer stable set search_path = '';

-- 5. HARDEN DEALER UPDATE VALIDATION: PROTECT is_demo FROM TAMPERING
create or replace function public.is_valid_dealer_update(d public.dealers)
returns boolean as $$
declare
  old_d public.dealers;
begin
  select * into old_d
  from public.dealers
  where id = d.id;

  if not found then
    return false;
  end if;

  -- Caller must own the dealer record
  if old_d.user_id != auth.uid() or d.user_id != auth.uid() then
    return false;
  end if;

  -- Non-admin cannot alter verification status, rating, or is_demo status
  return (
    old_d.is_verified is not distinct from d.is_verified
    and old_d.rating is not distinct from d.rating
    and old_d.is_demo is not distinct from d.is_demo
  );
end;
$$ language plpgsql security definer stable set search_path = '';

-- 6. SECURE RPC: get_demo_dealer_bookings() (Base version)
-- Returns real live customer pickup requests with strictly sanitized, non-sensitive columns.
-- Excludes: customer_name, phone_number, email, street_address, pincode, notes, photo_paths,
--           payment_method, payment_amount, payment_reference, driver_note, customer_id.
drop function if exists public.get_demo_dealer_bookings();

create or replace function public.get_demo_dealer_bookings()
returns table (
  id text,
  created_at timestamptz,
  status public.booking_status,
  estimated_total numeric,
  actual_total numeric,
  scheduled_pickup_at timestamptz,
  scheduled_date date,
  scheduled_time_slot text,
  preferred_date date,
  time_slot text,
  area text,
  city text,
  items jsonb
) as $$
begin
  -- 1. Strictly enforce authorization: caller must be an authorized demo dealer or system administrator
  if not public.is_demo_dealer() and not public.is_admin() then
    raise exception 'Access Denied: Only authenticated demo dealer or administrator accounts can view this read-only lead stream.'
      using errcode = '42501';
  end if;

  -- 2. Query real bookings and aggregate manifest line items safely
  return query
  select
    b.id,
    b.created_at,
    b.status,
    b.estimated_total,
    b.actual_total,
    b.scheduled_pickup_at,
    b.scheduled_date,
    b.scheduled_time_slot,
    b.preferred_date,
    b.time_slot,
    b.area,
    b.city,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'material_id', bi.material_id,
            'material_name', bi.material_name,
            'category', bi.category,
            'quantity', bi.quantity,
            'unit', bi.unit,
            'rate_per_unit', bi.rate_per_unit,
            'estimated_subtotal', bi.estimated_subtotal,
            'actual_quantity', bi.actual_quantity,
            'actual_rate', bi.actual_rate,
            'actual_subtotal', bi.actual_subtotal
          )
        )
        from public.booking_items bi
        where bi.booking_id = b.id
      ),
      '[]'::jsonb
    ) as items
  from public.bookings b
  where b.status in (
    'requested',
    'dealer_assigned',
    'scheduled',
    'on_the_way',
    'in_progress',
    'collected_weighed',
    'payment_completed',
    'completed',
    'rescheduled'
  )
  order by b.created_at desc
  limit 100;
end;
$$ language plpgsql security definer stable set search_path = '';

grant execute on function public.get_demo_dealer_bookings() to authenticated;

-- 7. STORAGE ACCESS HELPER: DEFAULT LOCKDOWN FOR DEMO DEALERS
create or replace function public.can_dealer_view_booking_photo(object_name text)
returns boolean as $$
declare
  target_booking_id text;
  v_dealer_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  -- Deny demo dealers by default in base migration
  if public.is_demo_dealer() then
    return false;
  end if;

  -- Caller must be an active verified dealer
  if not public.is_verified_dealer() then
    return false;
  end if;

  v_dealer_id := public.current_dealer_id();
  if v_dealer_id is null then
    return false;
  end if;

  -- Extract booking_id from storage path structure: <customer_id>/<booking_id>/<filename>
  target_booking_id := (string_to_array(object_name, '/'))[2];
  if target_booking_id is null or target_booking_id = '' then
    return false;
  end if;

  return exists (
    select 1 from public.bookings b
    where b.id = target_booking_id
      and (
        b.assigned_dealer_id = v_dealer_id
        or (b.status = 'requested' and b.assigned_dealer_id is null)
      )
  );
end;
$$ language plpgsql security definer stable set search_path = '';

grant execute on function public.can_dealer_view_booking_photo(text) to authenticated;
