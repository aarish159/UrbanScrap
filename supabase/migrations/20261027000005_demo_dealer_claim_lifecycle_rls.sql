-- ====================================================================
-- Urban Scrap Database Migration: 20261027000005_demo_dealer_claim_lifecycle_rls.sql
-- Description:
--   1. Allow authenticated Demo Dealer to safely accept/claim unassigned
--      'requested' customer bookings atomically via public.claim_pickup_lead()
--      or direct conditional update.
--   2. Auto-provision / link a real UUID dealer record in public.dealers for
--      authenticated demo dealer accounts via enhanced public.current_dealer_id().
--   3. Allow Demo Dealer to update and progress their assigned bookings
--      through existing lifecycle rules (scheduled, on_the_way, weigh, payment, complete).
--   4. Strictly forbid Demo Dealer from any admin actions (dealer approval, GST verification,
--      user roles, arbitrary booking edits) or touching other dealers' bookings.
--   5. Update public.dealers_select_policy so customers can view their assigned dealer's
--      details (name, phone, vehicle, rating) in "My Bookings" even if is_verified = false.
--   6. Update can_dealer_view_booking_photo() so Demo Dealer can view customer
--      photos of both unassigned requested bookings and their claimed bookings.
--   7. Atomic claim RPC public.claim_pickup_lead(p_booking_id text) returning structured JSONB.
--   8. Upgrade get_demo_dealer_bookings() to return both available leads and assigned pickups.
-- Idempotent, safe, and non-destructive.
-- ====================================================================

-- 1. SECURE HELPER FUNCTION: is_demo_dealer()
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
  ) or exists (
    select 1 from auth.users u
    where u.id = auth.uid() and (
      u.email ilike '%demo%dealer%'
      or u.raw_user_meta_data->>'is_demo' = 'true'
      or u.raw_user_meta_data->>'role' = 'demo_dealer'
    )
  );
end;
$$ language plpgsql security definer stable set search_path = '';

grant execute on function public.is_demo_dealer() to authenticated, anon;

-- 2. ENHANCE public.current_dealer_id()
-- Resolves authenticated user's dealer record UUID.
-- If user is an authorized demo dealer and has no row in public.dealers yet,
-- auto-provisions a safe demo partner record with a real UUID.
create or replace function public.current_dealer_id()
returns uuid as $$
declare
  d_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select id into d_id
  from public.dealers
  where user_id = auth.uid()
  limit 1;

  -- Auto-provision demo dealer record if authenticated demo user does not have one yet
  if d_id is null and public.is_demo_dealer() then
    insert into public.dealers (
      user_id,
      business_name,
      phone,
      service_area,
      vehicle_type,
      rating,
      is_verified,
      is_demo
    )
    values (
      auth.uid(),
      'UrbanScrap Demo Partner',
      '9876543210',
      'Bengaluru Central',
      'Mini Electric Van',
      4.90,
      false,
      true
    )
    on conflict (user_id) do update set is_demo = true
    returning id into d_id;
  end if;

  return d_id;
end;
$$ language plpgsql security definer volatile set search_path = '';

grant execute on function public.current_dealer_id() to authenticated;

-- 3. UPDATE is_valid_dealer_booking_update()
-- Allow authenticated demo dealer (who has is_verified = false) to execute
-- valid dealer booking state transitions under the EXACT same immutable customer checks.
create or replace function public.is_valid_dealer_booking_update(b public.bookings)
returns boolean as $$
declare
  old_b public.bookings;
  c_dealer_id uuid;
  dealer_is_verified boolean;
begin
  select id, is_verified into c_dealer_id, dealer_is_verified
  from public.dealers
  where user_id = auth.uid()
  limit 1;

  -- If not in dealers table yet, try resolving via current_dealer_id()
  if c_dealer_id is null then
    c_dealer_id := public.current_dealer_id();
  end if;

  -- Must be an active dealer account (verified dealer or authorized demo dealer)
  if c_dealer_id is null or (dealer_is_verified is not true and not public.is_demo_dealer()) then
    return false;
  end if;

  select * into old_b
  from public.bookings
  where id = b.id;

  if not found then
    return false;
  end if;

  -- STRICT CUSTOMER IMMUTABLE FIELDS CHECK:
  -- The dealer can NEVER alter customer identity, address, contact, preferred slot, notes,
  -- estimated total, or initial creation timestamp under ANY circumstances.
  if old_b.id != b.id
     or old_b.customer_id != b.customer_id
     or old_b.customer_name != b.customer_name
     or old_b.phone_number != b.phone_number
     or (old_b.email is distinct from b.email)
     or old_b.street_address != b.street_address
     or old_b.area != b.area
     or old_b.city != b.city
     or old_b.pincode != b.pincode
     or old_b.preferred_date != b.preferred_date
     or old_b.time_slot != b.time_slot
     or (old_b.notes is distinct from b.notes)
     or old_b.estimated_total != b.estimated_total
     or old_b.created_at != b.created_at then
    return false;
  end if;

  -- TRANSITION 1: Claiming an unassigned requested booking (requested -> dealer_assigned)
  if old_b.status = 'requested' and old_b.assigned_dealer_id is null then
    return (
      b.status = 'dealer_assigned'
      and b.assigned_dealer_id = c_dealer_id
      and (old_b.scheduled_pickup_at is not distinct from b.scheduled_pickup_at)
      and (old_b.scheduled_date is not distinct from b.scheduled_date)
      and (old_b.scheduled_time_slot is not distinct from b.scheduled_time_slot)
      and (old_b.driver_note is not distinct from b.driver_note)
      and (old_b.actual_total is not distinct from b.actual_total)
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      and (old_b.reschedule_reason is not distinct from b.reschedule_reason)
      and (old_b.rescheduled_date is not distinct from b.rescheduled_date)
      and (old_b.rescheduled_time_slot is not distinct from b.rescheduled_time_slot)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
    );
  end if;

  -- FOR ALL SUBSEQUENT DEALER UPDATES:
  -- The booking MUST already be assigned to this dealer, and dealer cannot reassign to another dealer.
  if old_b.assigned_dealer_id != c_dealer_id or b.assigned_dealer_id != c_dealer_id then
    return false;
  end if;

  -- TRANSITION 2: Scheduling the pickup (dealer_assigned / rescheduled / scheduled -> scheduled)
  if (old_b.status in ('dealer_assigned', 'rescheduled', 'scheduled')) and b.status = 'scheduled' then
    return (
      (b.scheduled_date is not null or b.scheduled_pickup_at is not null or b.rescheduled_date is not null)
      and (old_b.driver_note is not distinct from b.driver_note)
      and (old_b.actual_total is not distinct from b.actual_total)
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
    );
  end if;

  -- TRANSITION 3: Dealer on the way (scheduled -> on_the_way)
  if (old_b.status in ('scheduled', 'on_the_way')) and b.status = 'on_the_way' then
    return (
      (old_b.scheduled_pickup_at is not distinct from b.scheduled_pickup_at)
      and (old_b.scheduled_date is not distinct from b.scheduled_date)
      and (old_b.scheduled_time_slot is not distinct from b.scheduled_time_slot)
      and (old_b.actual_total is not distinct from b.actual_total)
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      and (old_b.reschedule_reason is not distinct from b.reschedule_reason)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
    );
  end if;

  -- TRANSITION 4: Scrap collected and weighed (on_the_way -> collected_weighed)
  if (old_b.status in ('on_the_way', 'in_progress', 'collected_weighed')) and b.status = 'collected_weighed' then
    return (
      (b.actual_total is not null and b.actual_total >= 0)
      and (old_b.scheduled_pickup_at is not distinct from b.scheduled_pickup_at)
      and (old_b.scheduled_date is not distinct from b.scheduled_date)
      and (old_b.scheduled_time_slot is not distinct from b.scheduled_time_slot)
      and (old_b.driver_note is not distinct from b.driver_note)
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      and (old_b.reschedule_reason is not distinct from b.reschedule_reason)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
    );
  end if;

  -- TRANSITION 5: Settle payment (collected_weighed -> payment_completed)
  if (old_b.status in ('collected_weighed', 'payment_completed')) and b.status = 'payment_completed' then
    return (
      (b.payment_method is not null and b.payment_amount is not null and b.payment_amount > 0)
      and (old_b.scheduled_pickup_at is not distinct from b.scheduled_pickup_at)
      and (old_b.scheduled_date is not distinct from b.scheduled_date)
      and (old_b.scheduled_time_slot is not distinct from b.scheduled_time_slot)
      and (old_b.driver_note is not distinct from b.driver_note)
      and (old_b.actual_total is not distinct from b.actual_total)
      and (old_b.reschedule_reason is not distinct from b.reschedule_reason)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
    );
  end if;

  -- TRANSITION 6: Finish order (payment_completed -> completed)
  if old_b.status = 'payment_completed' and b.status = 'completed' then
    return (
      (old_b.actual_total is not distinct from b.actual_total)
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      and (old_b.scheduled_pickup_at is not distinct from b.scheduled_pickup_at)
      and (old_b.scheduled_date is not distinct from b.scheduled_date)
      and (old_b.scheduled_time_slot is not distinct from b.scheduled_time_slot)
      and (old_b.driver_note is not distinct from b.driver_note)
      and (old_b.reschedule_reason is not distinct from b.reschedule_reason)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
    );
  end if;

  -- TRANSITION 7: Partner Rescheduling
  if old_b.status in ('dealer_assigned', 'scheduled', 'rescheduled') and b.status = 'rescheduled' then
    return (
      (b.reschedule_reason is not null and length(trim(b.reschedule_reason)) >= 3)
      and (old_b.actual_total is not distinct from b.actual_total)
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      and (old_b.driver_note is not distinct from b.driver_note)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
    );
  end if;

  -- TRANSITION 8: Partner Cancellation
  if old_b.status in ('dealer_assigned', 'scheduled', 'rescheduled') and b.status = 'cancelled' then
    return (
      (b.cancellation_reason is not null and length(trim(b.cancellation_reason)) >= 3)
      and (old_b.actual_total is not distinct from b.actual_total)
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      and (old_b.driver_note is not distinct from b.driver_note)
      and (old_b.reschedule_reason is not distinct from b.reschedule_reason)
    );
  end if;

  return false;
end;
$$ language plpgsql security definer stable set search_path = '';

grant execute on function public.is_valid_dealer_booking_update(public.bookings) to authenticated;

-- 4. BOOKINGS UPDATE POLICY
-- Allow authenticated demo dealer or verified dealer to claim unassigned requested leads,
-- and update bookings assigned to their dealer UUID.
drop policy if exists "bookings_update_policy" on public.bookings;
create policy "bookings_update_policy"
  on public.bookings for update
  using (
    customer_id = auth.uid()
    or assigned_dealer_id = public.current_dealer_id()
    or (
      status = 'requested'
      and assigned_dealer_id is null
      and (public.is_verified_dealer() or public.is_demo_dealer())
    )
    or public.is_admin()
  )
  with check (
    public.is_admin()
    or public.is_valid_booking_cancellation(bookings)
    or public.is_valid_dealer_booking_update(bookings)
  );

-- 5. BOOKINGS SELECT POLICY
-- Allow demo dealer and verified dealers to select unassigned requested leads AND their assigned bookings.
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

-- 6. BOOKING ITEMS SELECT POLICY
-- Allow demo dealer and verified dealers to select booking items for unassigned leads and their assigned bookings.
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

-- 7. BOOKING STATUS HISTORY SELECT POLICY
-- Allow demo dealer and verified dealers to select status history for unassigned leads and their assigned bookings.
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

-- 8. DEALERS SELECT POLICY
-- Allow customers to view their assigned dealer's profile (name, phone, vehicle, rating),
-- whether that dealer is verified or demo partner.
drop policy if exists "dealers_select_policy" on public.dealers;
create policy "dealers_select_policy"
  on public.dealers for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      id in (
        select assigned_dealer_id from public.bookings
        where customer_id = auth.uid()
      )
    )
    or is_verified = true
  );

-- 9. STORAGE POLICY HELPER: can_dealer_view_booking_photo
-- Allow demo dealer and verified dealers to view photos of unassigned requested bookings OR bookings assigned to them.
create or replace function public.can_dealer_view_booking_photo(object_name text)
returns boolean as $$
declare
  clean_path text;
  target_booking_id text;
  v_dealer_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  clean_path := regexp_replace(object_name, '^booking-photos/', '');
  target_booking_id := (string_to_array(clean_path, '/'))[2];

  if target_booking_id is null or target_booking_id = '' then
    return false;
  end if;

  v_dealer_id := public.current_dealer_id();
  if v_dealer_id is null then
    return false;
  end if;

  -- Authenticated Demo Dealer
  if public.is_demo_dealer() then
    return exists (
      select 1 from public.bookings b
      where b.id = target_booking_id
        and (clean_path = any(b.photo_paths) or object_name = any(b.photo_paths))
        and (
          (b.status = 'requested' and b.assigned_dealer_id is null)
          or b.assigned_dealer_id = v_dealer_id
        )
    );
  end if;

  -- Verified Dealer
  if not public.is_verified_dealer() then
    return false;
  end if;

  return exists (
    select 1 from public.bookings b
    where b.id = target_booking_id
      and (clean_path = any(b.photo_paths) or object_name = any(b.photo_paths))
      and (
        b.assigned_dealer_id = v_dealer_id
        or (b.status = 'requested' and b.assigned_dealer_id is null)
      )
  );
end;
$$ language plpgsql security definer stable set search_path = '';

grant execute on function public.can_dealer_view_booking_photo(text) to authenticated;

-- Ensure storage policy on storage.objects references can_dealer_view_booking_photo
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'storage' and tablename = 'objects'
  ) then
    drop policy if exists "dealers_view_booking_photos" on storage.objects;
    create policy "dealers_view_booking_photos"
      on storage.objects for select
      using (
        bucket_id = 'booking-photos'
        and public.can_dealer_view_booking_photo(name)
      );
  end if;
end $$;

-- 10. ATOMIC CLAIM RPC: public.claim_pickup_lead(p_booking_id text)
-- Guarantees atomic lock-free acceptance of an available lead.
create or replace function public.claim_pickup_lead(p_booking_id text)
returns jsonb as $$
declare
  v_dealer_id uuid;
  v_updated record;
  v_current_status text;
  v_current_assigned uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'success', false,
      'error', 'SESSION_EXPIRED',
      'message', 'Your session has expired. Please sign in again.'
    );
  end if;

  if not public.is_verified_dealer() and not public.is_demo_dealer() and not public.is_admin() then
    return jsonb_build_object(
      'success', false,
      'error', 'PERMISSION_DENIED',
      'message', 'Access Denied: Only authenticated dealer partners can accept pickup leads.'
    );
  end if;

  v_dealer_id := public.current_dealer_id();
  if v_dealer_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'DEALER_PROFILE_MISSING',
      'message', 'Dealer profile not found for current session.'
    );
  end if;

  -- Check current booking state to provide precise diagnostic error
  select status, assigned_dealer_id into v_current_status, v_current_assigned
  from public.bookings
  where id = p_booking_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'NOT_FOUND',
      'message', 'Pickup request not found in database.'
    );
  end if;

  -- Idempotency check: Already claimed by this dealer
  if v_current_assigned = v_dealer_id then
    return jsonb_build_object(
      'success', true,
      'already_assigned', true,
      'booking_id', p_booking_id,
      'status', v_current_status,
      'assigned_dealer_id', v_dealer_id,
      'message', 'This pickup request is already claimed and assigned to your dealership.'
    );
  end if;

  -- Claimed by another dealer or no longer requested
  if v_current_status != 'requested' or v_current_assigned is not null then
    return jsonb_build_object(
      'success', false,
      'error', 'LEAD_ALREADY_CLAIMED',
      'message', 'This pickup request has already been claimed by another partner or is no longer available.'
    );
  end if;

  -- Atomic update: only claims if currently 'requested' and unassigned
  update public.bookings
  set
    status = 'dealer_assigned',
    assigned_dealer_id = v_dealer_id,
    updated_at = now()
  where id = p_booking_id
    and status = 'requested'
    and assigned_dealer_id is null
  returning id, status, assigned_dealer_id into v_updated;

  if v_updated.id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'LEAD_ALREADY_CLAIMED',
      'message', 'This pickup request was just claimed by another partner.'
    );
  end if;

  -- Record status audit log (fallback if trigger does not record it)
  if not exists (
    select 1 from public.booking_status_history
    where booking_id = p_booking_id and new_status = 'dealer_assigned'
  ) then
    insert into public.booking_status_history (
      booking_id,
      old_status,
      new_status,
      actor_id,
      note
    ) values (
      p_booking_id,
      'requested',
      'dealer_assigned',
      auth.uid(),
      'Pickup claimed and assigned to dealer partner.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'booking_id', v_updated.id,
    'status', v_updated.status,
    'assigned_dealer_id', v_updated.assigned_dealer_id,
    'message', 'Pickup lead successfully accepted and assigned.'
  );
end;
$$ language plpgsql security definer volatile set search_path = '';

grant execute on function public.claim_pickup_lead(text) to authenticated;

-- 11. UPGRADE get_demo_dealer_bookings() RPC
-- Returns both unassigned requested bookings (Available Leads) AND bookings assigned to the demo dealer.
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
  customer_name text,
  phone_number text,
  email text,
  street_address text,
  pincode text,
  notes text,
  driver_note text,
  cancellation_reason text,
  reschedule_reason text,
  rescheduled_date date,
  rescheduled_time_slot text,
  payment_method text,
  payment_amount numeric,
  payment_reference text,
  assigned_dealer_id uuid,
  items jsonb,
  photo_paths text[],
  status_history jsonb
) as $$
declare
  v_dealer_id uuid;
begin
  if not public.is_demo_dealer() and not public.is_admin() then
    raise exception 'Access Denied: Only authenticated demo dealer or administrator accounts can view this stream.'
      using errcode = '42501';
  end if;

  v_dealer_id := public.current_dealer_id();

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
    case when b.assigned_dealer_id = v_dealer_id then b.customer_name else 'Customer (Lead Pool)' end as customer_name,
    case when b.assigned_dealer_id = v_dealer_id then b.phone_number else '••••••••••' end as phone_number,
    case when b.assigned_dealer_id = v_dealer_id then b.email else null end as email,
    case when b.assigned_dealer_id = v_dealer_id then b.street_address else (b.area || ', ' || b.city) end as street_address,
    case when b.assigned_dealer_id = v_dealer_id then b.pincode else '••••••' end as pincode,
    case when b.assigned_dealer_id = v_dealer_id then b.notes else null end as notes,
    b.driver_note,
    b.cancellation_reason,
    b.reschedule_reason,
    b.rescheduled_date,
    b.rescheduled_time_slot,
    b.payment_method,
    b.payment_amount,
    b.payment_reference,
    b.assigned_dealer_id,
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
    coalesce(b.photo_paths, array[]::text[]) as photo_paths,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', h.id,
            'new_status', h.new_status,
            'note', h.note,
            'created_at', h.created_at
          ) order by h.created_at asc
        )
        from public.booking_status_history h
        where h.booking_id = b.id
      ),
      '[]'::jsonb
    ) as status_history
  from public.bookings b
  where (b.status = 'requested' and b.assigned_dealer_id is null)
     or (v_dealer_id is not null and b.assigned_dealer_id = v_dealer_id)
  order by b.created_at desc
  limit 100;
end;
$$ language plpgsql security definer stable set search_path = '';

grant execute on function public.get_demo_dealer_bookings() to authenticated;
