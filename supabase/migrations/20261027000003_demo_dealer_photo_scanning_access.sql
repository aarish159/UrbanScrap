-- ====================================================================
-- Urban Scrap Database Migration: 20261027000003_demo_dealer_photo_scanning_access.sql
-- Description: Incremental migration for Demo Dealer Customer Scrap Photo Scanning:
--   1. Upgrade get_demo_dealer_bookings() RPC to include storage photo_paths
--      (allows demo dealer dashboard to resolve signed URLs for customer photos)
--   2. Update can_dealer_view_booking_photo() storage helper to permit authenticated
--      demo dealers to read/scan photos belonging strictly to eligible, active
--      customer bookings registered in public.bookings.photo_paths.
-- Safe, non-destructive, and idempotent to run in Supabase SQL Editor.
-- ====================================================================

-- 1. UPGRADE RPC: get_demo_dealer_bookings()
-- Drop prior signature to allow column return type modification
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
  items jsonb,
  photo_paths text[]
) as $$
begin
  -- 1. Strictly enforce authorization: caller must be an authorized demo dealer or system administrator
  if not public.is_demo_dealer() and not public.is_admin() then
    raise exception 'Access Denied: Only authenticated demo dealer or administrator accounts can view this read-only lead stream.'
      using errcode = '42501';
  end if;

  -- 2. Query real bookings and aggregate manifest line items safely
  -- Sanitized: excludes customer full name, phone number, email, street address, pincode, private notes,
  --            driver note, payment reference, and internal billing details.
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
    ) as items,
    coalesce(b.photo_paths, array[]::text[]) as photo_paths
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

-- 2. STORAGE ACCESS HELPER FOR BOOKING PHOTOS
-- Strictly scopes read access to customer booking photos:
--   a) Customer who uploaded (<customer_id> folder match handled in RLS policy)
--   b) Verified dealers: for assigned pickups or unassigned marketplace leads
--   c) Demo dealers: for active, eligible real customer bookings where the photo is registered in b.photo_paths
--   d) Administrators: full access
create or replace function public.can_dealer_view_booking_photo(object_name text)
returns boolean as $$
declare
  target_booking_id text;
  v_dealer_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  -- Extract booking_id from storage path structure: <customer_id>/<booking_id>/<filename>
  target_booking_id := (string_to_array(object_name, '/'))[2];
  if target_booking_id is null or target_booking_id = '' then
    return false;
  end if;

  -- CASE 1: Authenticated Demo Dealer
  -- Authorized to view and scan photos ONLY of real, active customer pickup requests
  -- where the object path is recorded in that booking's photo_paths
  if public.is_demo_dealer() then
    return exists (
      select 1 from public.bookings b
      where b.id = target_booking_id
        and object_name = any(b.photo_paths)
        and b.status in (
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
    );
  end if;

  -- CASE 2: Active Verified Real Dealer
  if not public.is_verified_dealer() then
    return false;
  end if;

  v_dealer_id := public.current_dealer_id();
  if v_dealer_id is null then
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
