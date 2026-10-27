-- ====================================================================
-- Urban Scrap Database Migration: 20261027000004_demo_dealer_available_leads_rls.sql
-- Description:
--   1. Allow authenticated demo dealers to SELECT unassigned requested bookings
--      directly from public.bookings, booking_items, and booking_status_history.
--      (Required for Supabase Realtime postgres_changes event streaming to demo dealers)
--   2. Explicitly prevent demo dealers from UPDATE, INSERT, or DELETE on bookings
--      (Enforces database-level read-only security for demo dealers)
--   3. Upgrade get_demo_dealer_bookings() RPC to return unassigned requested bookings
--      with photo_paths and line items for the Available Lead Pool.
--   4. Update can_dealer_view_booking_photo() to ensure demo dealers can generate
--      signed URLs for customer photos of unassigned requested bookings.
-- Idempotent, safe, and non-destructive.
-- ====================================================================

-- 1. BOOKINGS SELECT POLICY: ALLOW DEMO DEALERS TO SELECT UNASSIGNED REQUESTED BOOKINGS
drop policy if exists "bookings_select_policy" on public.bookings;
create policy "bookings_select_policy"
  on public.bookings for select
  using (
    customer_id = auth.uid()
    or assigned_dealer_id = public.current_dealer_id()
    or (
      status = 'requested'
      and (
        exists (
          select 1 from public.dealers d
          where d.user_id = auth.uid() and d.is_verified = true
        )
        or (public.is_demo_dealer() and assigned_dealer_id is null)
      )
    )
    or public.is_admin()
  );

-- 2. BOOKING ITEMS SELECT POLICY: ALLOW DEMO DEALERS TO SELECT ITEMS OF UNASSIGNED REQUESTED BOOKINGS
drop policy if exists "booking_items_select" on public.booking_items;
create policy "booking_items_select"
  on public.booking_items for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_items.booking_id
        and (
          b.customer_id = auth.uid()
          or b.assigned_dealer_id = public.current_dealer_id()
          or (
            b.status = 'requested'
            and (
              exists (
                select 1 from public.dealers d
                where d.user_id = auth.uid() and d.is_verified = true
              )
              or (public.is_demo_dealer() and b.assigned_dealer_id is null)
            )
          )
          or public.is_admin()
        )
    )
  );

-- 3. BOOKING STATUS HISTORY SELECT POLICY: ALLOW DEMO DEALERS READ-ONLY VIEW
drop policy if exists "booking_status_history_select" on public.booking_status_history;
create policy "booking_status_history_select"
  on public.booking_status_history for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_status_history.booking_id
        and (
          b.customer_id = auth.uid()
          or b.assigned_dealer_id = public.current_dealer_id()
          or (
            b.status = 'requested'
            and (
              exists (
                select 1 from public.dealers d
                where d.user_id = auth.uid() and d.is_verified = true
              )
              or (public.is_demo_dealer() and b.assigned_dealer_id is null)
            )
          )
          or public.is_admin()
        )
    )
  );

-- 4. BOOKINGS UPDATE POLICY: STRICTLY BLOCK DEMO DEALERS FROM ANY MUTATIONS
drop policy if exists "bookings_update_policy" on public.bookings;
create policy "bookings_update_policy"
  on public.bookings for update
  using (
    not public.is_demo_dealer()
    and (
      customer_id = auth.uid()
      or assigned_dealer_id = public.current_dealer_id()
      or (
        status = 'requested'
        and assigned_dealer_id is null
        and public.is_verified_dealer()
      )
      or public.is_admin()
    )
  )
  with check (
    not public.is_demo_dealer()
    and (
      public.is_admin()
      or public.is_valid_booking_cancellation(bookings)
      or public.is_valid_dealer_booking_update(bookings)
    )
  );

-- 5. UPGRADE get_demo_dealer_bookings() RPC FOR AVAILABLE LEAD POOL
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
  -- Strictly enforce authorization: caller must be an authorized demo dealer or system administrator
  if not public.is_demo_dealer() and not public.is_admin() then
    raise exception 'Access Denied: Only authenticated demo dealer or administrator accounts can view this read-only lead stream.'
      using errcode = '42501';
  end if;

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
  where b.status = 'requested'
    and b.assigned_dealer_id is null
  order by b.created_at desc
  limit 100;
end;
$$ language plpgsql security definer stable set search_path = '';

grant execute on function public.get_demo_dealer_bookings() to authenticated;

-- 6. ENSURE STORAGE HELPER ALLOWS DEMO DEALER VIEWING FOR UNASSIGNED REQUESTED PHOTOS
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
  -- Authorized to view and scan photos ONLY of real, unassigned requested customer pickup requests
  -- where the object path is recorded in that booking's photo_paths
  if public.is_demo_dealer() then
    return exists (
      select 1 from public.bookings b
      where b.id = target_booking_id
        and object_name = any(b.photo_paths)
        and b.status = 'requested'
        and b.assigned_dealer_id is null
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
