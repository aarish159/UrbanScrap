-- ====================================================================
-- Urban Scrap Database Migration: 20261025000001_pickup_order_tracking.sql
-- Description: End-to-end pickup order tracking system:
--  - Adds tracking & fulfillment columns to public.bookings
--  - Adds actual weighing columns to public.booking_items
--  - Enforces strict lifecycle state progression:
--      * cannot move to on_the_way before scheduled
--      * cannot move to completed before payment_completed
--      * legacy records in in_progress can bridge into collected_weighed
--  - Enforces that dealer weighing edits to booking_items are allowed ONLY before
--    collected_weighed (during on_the_way or in_progress)
--  - Requires every item to have valid actual_quantity, actual_rate, and actual_subtotal
--    matching quantity * rate rounding before accepting transition to collected_weighed
--  - Enforces actual_total on bookings matches the exact sum of booking_items.actual_subtotal
--  - Enforces payment_amount on bookings matches verified actual_total upon payment_completed
--  - Restricts customer updates on booking_items to quantity (> 0), protecting rate_per_unit
--    from tampering and validating estimated_subtotal against database-calculated round(quantity * rate, 2)
--  - Enforces database-level constraint that dealers modify ONLY actual weighing columns on booking_items
--  - Requires customer cancellation reason with minimum length check
--  - Requires dealer rescheduling reason, proposed date, and time slot
--  - Re-asserts bookings UPDATE policy dropping only verified conflicting UPDATE policy
--  - Updates booking_items update and delete RLS policies
--  - Updates booking_status_history read security for verified dealers
--  - Hardens all SECURITY DEFINER functions with search_path = '' and schema-qualified references
--
-- PREREQUISITE:
--  Enum additions must be committed prior to running this migration:
--  Run migration 20261025000000_add_pickup_tracking_enums.sql first.
-- ====================================================================

-- 1. ADD TRACKING & FULFILLMENT COLUMNS TO BOOKINGS
alter table public.bookings
  add column if not exists scheduled_pickup_at timestamptz,
  add column if not exists scheduled_date date,
  add column if not exists scheduled_time_slot text,
  add column if not exists actual_total numeric(12, 2) check (actual_total is null or actual_total >= 0),
  add column if not exists payment_method text check (payment_method is null or payment_method in ('cash', 'upi', 'bank_transfer')),
  add column if not exists payment_amount numeric(12, 2) check (payment_amount is null or payment_amount >= 0),
  add column if not exists payment_reference text,
  add column if not exists driver_note text,
  add column if not exists cancellation_reason text,
  add column if not exists reschedule_reason text,
  add column if not exists rescheduled_date date,
  add column if not exists rescheduled_time_slot text;

-- Indexes for tracking queries
create index if not exists idx_bookings_scheduled_date on public.bookings(scheduled_date);
create index if not exists idx_bookings_scheduled_pickup_at on public.bookings(scheduled_pickup_at);

-- 2. ADD ACTUAL WEIGHING COLUMNS TO BOOKING ITEMS
alter table public.booking_items
  add column if not exists actual_quantity numeric(10, 2) check (actual_quantity is null or actual_quantity >= 0),
  add column if not exists actual_rate numeric(10, 2) check (actual_rate is null or actual_rate >= 0),
  add column if not exists actual_subtotal numeric(12, 2) check (actual_subtotal is null or actual_subtotal >= 0);

-- 3. HELPER FUNCTION: VERIFIED DEALER CHECK
-- Safely checks whether current authenticated user has an active, verified dealer profile
create or replace function public.is_verified_dealer()
returns boolean as $$
begin
  return exists (
    select 1 from public.dealers
    where user_id = auth.uid() and is_verified = true
  );
end;
$$ language plpgsql security definer stable
set search_path = '';

-- 4. CUSTOMER CANCELLATION VALIDATION FUNCTION
-- Allows customers to cancel their own booking from unfulfilled states,
-- requiring a meaningful cancellation reason (minimum 3 characters) and strictly preventing
-- alteration of immutable booking details or dealer fulfillment fields.
create or replace function public.is_valid_booking_cancellation(b public.bookings)
returns boolean as $$
declare
  old_b public.bookings;
begin
  select * into old_b
  from public.bookings
  where id = b.id;

  if not found then
    return false;
  end if;

  -- Caller must be the customer who owns this booking
  if old_b.customer_id != auth.uid() or b.customer_id != auth.uid() then
    return false;
  end if;

  -- Only cancellable from unfulfilled states before scrap collection starts
  if old_b.status not in ('requested', 'dealer_assigned', 'scheduled', 'rescheduled') then
    return false;
  end if;

  -- Target status must be 'cancelled'
  if b.status != 'cancelled' then
    return false;
  end if;

  -- Cancellation must require a non-empty cancellation_reason with minimum length (at least 3 characters)
  if b.cancellation_reason is null or pg_catalog.length(pg_catalog.btrim(b.cancellation_reason)) < 3 then
    return false;
  end if;

  -- Strict immutable fields check:
  -- Customer identity, address, items total, pickup requirements, and created_at cannot be altered
  if old_b.id != b.id
     or old_b.customer_id != b.customer_id
     or (old_b.assigned_dealer_id is distinct from b.assigned_dealer_id)
     or old_b.estimated_total != b.estimated_total
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
     or old_b.created_at != b.created_at then
    return false;
  end if;

  -- Customer must not tamper with dealer tracking or payment fields
  if (old_b.scheduled_pickup_at is distinct from b.scheduled_pickup_at)
     or (old_b.scheduled_date is distinct from b.scheduled_date)
     or (old_b.scheduled_time_slot is distinct from b.scheduled_time_slot)
     or (old_b.actual_total is distinct from b.actual_total)
     or (old_b.payment_method is distinct from b.payment_method)
     or (old_b.payment_amount is distinct from b.payment_amount)
     or (old_b.payment_reference is distinct from b.payment_reference)
     or (old_b.driver_note is distinct from b.driver_note)
     or (old_b.reschedule_reason is distinct from b.reschedule_reason)
     or (old_b.rescheduled_date is distinct from b.rescheduled_date)
     or (old_b.rescheduled_time_slot is distinct from b.rescheduled_time_slot) then
    return false;
  end if;

  return true;
end;
$$ language plpgsql security definer stable
set search_path = '';

-- 4. DEALER BOOKING UPDATE VALIDATION FUNCTION
-- Enforces dealer verification, strict field immutability, authorized lifecycle
-- state progression, required rescheduling details, and enforces that unrelated payment,
-- weighing, schedule, assignment, or cancellation fields CANNOT be modified outside allowed transitions.
create or replace function public.is_valid_dealer_booking_update(b public.bookings)
returns boolean as $$
declare
  old_b public.bookings;
  c_dealer_id uuid;
  dealer_is_verified boolean;
  item_sum numeric(12, 2);
  item_count integer;
  invalid_item_count integer;
begin
  select id, is_verified into c_dealer_id, dealer_is_verified
  from public.dealers
  where user_id = auth.uid()
  limit 1;

  if c_dealer_id is null or dealer_is_verified is not true then
    return false;
  end if;

  select * into old_b
  from public.bookings
  where id = b.id;

  if not found then
    return false;
  end if;

  -- 1. STRICT CUSTOMER IMMUTABLE FIELDS CHECK:
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

  -- 2. TRANSITION 1: Claiming an unassigned requested booking (requested -> dealer_assigned)
  if old_b.status = 'requested' and old_b.assigned_dealer_id is null then
    return (
      b.status = 'dealer_assigned'
      and b.assigned_dealer_id = c_dealer_id
      -- No fulfillment, schedule, weighing, payment, or cancellation fields can be populated during claiming:
      and b.scheduled_pickup_at is null
      and b.scheduled_date is null
      and b.scheduled_time_slot is null
      and b.driver_note is null
      and b.actual_total is null
      and b.payment_method is null
      and b.payment_amount is null
      and b.payment_reference is null
      and b.reschedule_reason is null
      and b.rescheduled_date is null
      and b.rescheduled_time_slot is null
      and b.cancellation_reason is null
    );
  end if;

  -- FOR ALL SUBSEQUENT DEALER UPDATES:
  -- The booking MUST already be assigned to this dealer, and dealer cannot reassign to another dealer.
  if old_b.assigned_dealer_id != c_dealer_id or b.assigned_dealer_id != c_dealer_id then
    return false;
  end if;

  -- 3. TRANSITION 2: Scheduling the pickup (dealer_assigned / rescheduled / scheduled -> scheduled)
  if (old_b.status in ('dealer_assigned', 'rescheduled', 'scheduled')) and b.status = 'scheduled' then
    return (
      -- Must provide a confirmed date or pickup timestamp
      (b.scheduled_date is not null or b.scheduled_pickup_at is not null or b.rescheduled_date is not null)
      -- Unrelated fields MUST NOT be altered during scheduling:
      and (old_b.driver_note is not distinct from b.driver_note)
      and (old_b.actual_total is not distinct from b.actual_total)
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
    );
  end if;

  -- 4. TRANSITION 3: Dealer on the way (scheduled -> on_the_way, or updating driver note while on_the_way)
  -- Requirement 1: Booking MUST NOT move to on_the_way before scheduled!
  if (old_b.status in ('scheduled', 'on_the_way')) and b.status = 'on_the_way' then
    return (
      -- Schedule fields cannot be mutated while en route:
      (old_b.scheduled_pickup_at is not distinct from b.scheduled_pickup_at)
      and (old_b.scheduled_date is not distinct from b.scheduled_date)
      and (old_b.scheduled_time_slot is not distinct from b.scheduled_time_slot)
      -- Weighing, payment, and cancellation fields cannot be altered while en route:
      and (old_b.actual_total is not distinct from b.actual_total)
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      and (old_b.reschedule_reason is not distinct from b.reschedule_reason)
      and (old_b.rescheduled_date is not distinct from b.rescheduled_date)
      and (old_b.rescheduled_time_slot is not distinct from b.rescheduled_time_slot)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
      -- driver_note is allowed to be updated
    );
  end if;

  -- 5. TRANSITION 4: Scrap collected and weighed (on_the_way / in_progress -> collected_weighed)
  -- Requires that all booking items have been weighed and priced BEFORE transitioning to collected_weighed.
  -- Legacy compatibility: records currently in 'in_progress' from legacy schema can enter the modern pipeline here.
  if (old_b.status in ('on_the_way', 'in_progress')) and b.status = 'collected_weighed' then
    if b.actual_total is null or b.actual_total < 0 then
      return false;
    end if;

    -- Confirm every item has actual_quantity >= 0, actual_rate >= 0,
    -- valid actual_subtotal, and actual_total matches sum of itemized actual_subtotal
    select coalesce(sum(actual_subtotal), 0),
           count(*),
           count(*) filter (
             where actual_quantity is null 
                or actual_quantity < 0
                or actual_rate is null
                or actual_rate < 0
                or actual_subtotal is null
                or actual_subtotal < 0
                or not (
                  actual_subtotal = pg_catalog.round(actual_quantity * actual_rate, 2)
                  or actual_subtotal = pg_catalog.round(actual_quantity * actual_rate, 0)
                )
           )
    into item_sum, item_count, invalid_item_count
    from public.booking_items
    where booking_id = b.id;

    if item_count = 0 or invalid_item_count > 0 or b.actual_total != item_sum then
      return false;
    end if;

    return (
      -- Schedule and driver note cannot be mutated during weighing:
      (old_b.scheduled_pickup_at is not distinct from b.scheduled_pickup_at)
      and (old_b.scheduled_date is not distinct from b.scheduled_date)
      and (old_b.scheduled_time_slot is not distinct from b.scheduled_time_slot)
      and (old_b.driver_note is not distinct from b.driver_note)
      -- Payment details CANNOT be forged or mutated during weighing step (payment is next step):
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      -- Rescheduling or cancellation fields cannot be altered:
      and (old_b.reschedule_reason is not distinct from b.reschedule_reason)
      and (old_b.rescheduled_date is not distinct from b.rescheduled_date)
      and (old_b.rescheduled_time_slot is not distinct from b.rescheduled_time_slot)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
    );
  end if;

  -- 6. TRANSITION 5: Payment completed (collected_weighed / payment_completed -> payment_completed)
  if (old_b.status in ('collected_weighed', 'payment_completed')) and b.status = 'payment_completed' then
    return (
      -- Valid payment details required; payout amount must match verified weighed actual_total exactly
      b.payment_method in ('cash', 'upi', 'bank_transfer')
      and b.payment_amount is not null
      and old_b.actual_total is not null
      and b.payment_amount = old_b.actual_total
      -- Weighed total cannot be modified during payment:
      and (old_b.actual_total is not distinct from b.actual_total)
      -- Schedule, notes, rescheduling, and cancellation cannot be modified:
      and (old_b.scheduled_pickup_at is not distinct from b.scheduled_pickup_at)
      and (old_b.scheduled_date is not distinct from b.scheduled_date)
      and (old_b.scheduled_time_slot is not distinct from b.scheduled_time_slot)
      and (old_b.driver_note is not distinct from b.driver_note)
      and (old_b.reschedule_reason is not distinct from b.reschedule_reason)
      and (old_b.rescheduled_date is not distinct from b.rescheduled_date)
      and (old_b.rescheduled_time_slot is not distinct from b.rescheduled_time_slot)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
    );
  end if;

  -- 7. TRANSITION 6: Final pickup completed (payment_completed -> completed)
  -- Requirement 1: Booking MUST NOT move to completed before payment_completed!
  if old_b.status = 'payment_completed' and b.status = 'completed' then
    return (
      -- All fields must remain preserved; only status transitions to completed:
      (old_b.scheduled_pickup_at is not distinct from b.scheduled_pickup_at)
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

  -- 8. TRANSITION 7: Rescheduled (dealer proposes new time with reason and slot)
  if (old_b.status in ('dealer_assigned', 'scheduled', 'on_the_way', 'in_progress', 'rescheduled')) and b.status = 'rescheduled' then
    return (
      -- Requires non-empty reason (min 3 chars), proposed date, and time slot
      b.reschedule_reason is not null
      and pg_catalog.length(pg_catalog.btrim(b.reschedule_reason)) >= 3
      and b.rescheduled_date is not null
      and b.rescheduled_time_slot is not null
      and pg_catalog.length(pg_catalog.btrim(b.rescheduled_time_slot)) > 0
      -- Weighing, payment, and cancellation fields cannot be forged or altered during reschedule:
      and (old_b.actual_total is not distinct from b.actual_total)
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      and (old_b.cancellation_reason is not distinct from b.cancellation_reason)
    );
  end if;

  -- 9. TRANSITION 8: Dealer cancellation (with reason)
  if (old_b.status in ('dealer_assigned', 'scheduled', 'on_the_way', 'in_progress', 'rescheduled')) and b.status = 'cancelled' then
    return (
      -- Requires non-empty reason (min 3 chars)
      b.cancellation_reason is not null
      and pg_catalog.length(pg_catalog.btrim(b.cancellation_reason)) >= 3
      -- Weighing, payment, and rescheduling fields cannot be altered during cancellation:
      and (old_b.actual_total is not distinct from b.actual_total)
      and (old_b.payment_method is not distinct from b.payment_method)
      and (old_b.payment_amount is not distinct from b.payment_amount)
      and (old_b.payment_reference is not distinct from b.payment_reference)
      and (old_b.scheduled_pickup_at is not distinct from b.scheduled_pickup_at)
      and (old_b.scheduled_date is not distinct from b.scheduled_date)
      and (old_b.scheduled_time_slot is not distinct from b.scheduled_time_slot)
      and (old_b.reschedule_reason is not distinct from b.reschedule_reason)
      and (old_b.rescheduled_date is not distinct from b.rescheduled_date)
      and (old_b.rescheduled_time_slot is not distinct from b.rescheduled_time_slot)
    );
  end if;

  return false;
end;
$$ language plpgsql security definer stable
set search_path = '';

-- 5. RE-ASSERT BOOKINGS UPDATE RLS POLICY
-- Only drop the verified existing UPDATE policy "bookings_update_policy".
-- Never drop ALL or wildcard policies, preserving SELECT, INSERT, and DELETE access.
drop policy if exists "bookings_update_policy" on public.bookings;

create policy "bookings_update_policy"
  on public.bookings for update
  using (
    customer_id = auth.uid()
    or assigned_dealer_id = public.current_dealer_id()
    or (
      status = 'requested'
      and assigned_dealer_id is null
      and public.is_verified_dealer()
    )
    or public.is_admin()
  )
  with check (
    public.is_admin()
    or public.is_valid_booking_cancellation(bookings)
    or public.is_valid_dealer_booking_update(bookings)
  );

-- 6. DATABASE-LEVEL VALIDATION FUNCTION FOR BOOKING ITEMS UPDATES
-- Dealer weighing updates are permitted ONLY before collected_weighed (during on_the_way or in_progress).
-- While status is 'requested', customers may ONLY adjust quantity (> 0).
-- Structural, catalogue, and price fields are strictly immutable; dealer actuals must be preserved
-- exactly using IS NOT DISTINCT FROM (cannot clear to NULL).
create or replace function public.is_valid_booking_item_update(item public.booking_items)
returns boolean as $$
declare
  old_item public.booking_items;
  parent_b public.bookings;
  c_dealer_id uuid;
begin
  select * into old_item
  from public.booking_items
  where id = item.id;

  if not found then
    return false;
  end if;

  select * into parent_b
  from public.bookings
  where id = old_item.booking_id;

  if not found then
    return false;
  end if;

  -- Admins have unrestricted update rights
  if public.is_admin() then
    return true;
  end if;

  -- Structural constraint: item cannot be reassigned to another booking
  if old_item.booking_id != item.booking_id then
    return false;
  end if;

  -- Case A: Customer updating their requested booking items
  -- Permitted edit: quantity (> 0).
  -- Explicitly protect rate_per_unit from customer edits (item.rate_per_unit = old_item.rate_per_unit).
  -- Validate estimated_subtotal against the trusted database calculation (round(quantity * rate, 2)),
  -- matching BEFORE UPDATE trigger verify_and_calculate_booking_item() and preventing client price forgery.
  -- All catalogue/structural columns are immutable; dealer actuals are preserved with IS NOT DISTINCT FROM.
  if parent_b.customer_id = auth.uid() and parent_b.status = 'requested' then
    return (
      item.id = old_item.id
      and item.booking_id = old_item.booking_id
      and item.material_id = old_item.material_id
      and item.material_name = old_item.material_name
      and item.category = old_item.category
      and item.quantity > 0
      and item.unit = old_item.unit
      and item.rate_per_unit = old_item.rate_per_unit
      and item.estimated_subtotal = pg_catalog.round(item.quantity * old_item.rate_per_unit, 2)
      and item.created_at = old_item.created_at
      -- Preserve all dealer actual fields exactly using IS NOT DISTINCT FROM (cannot clear to NULL)
      and (item.actual_quantity is not distinct from old_item.actual_quantity)
      and (item.actual_rate is not distinct from old_item.actual_rate)
      and (item.actual_subtotal is not distinct from old_item.actual_subtotal)
    );
  end if;

  -- Case B: Dealer updating weighing actuals during fulfillment (BEFORE collected_weighed)
  -- Edits are allowed ONLY while status is on_the_way or legacy in_progress.
  -- Once the parent booking transitions to collected_weighed, dealer actual edits are permanently locked.
  c_dealer_id := public.current_dealer_id();
  if c_dealer_id is not null
     and parent_b.assigned_dealer_id = c_dealer_id
     and parent_b.status in ('on_the_way', 'in_progress') then
    -- Dealers MUST ONLY modify actual weighing columns:
    -- actual_quantity, actual_rate, and actual_subtotal.
    -- All customer-submitted and material catalogue fields MUST be strictly immutable:
    return (
      item.id = old_item.id
      and item.booking_id = old_item.booking_id
      and item.material_id = old_item.material_id
      and item.material_name = old_item.material_name
      and item.category = old_item.category
      and item.quantity = old_item.quantity
      and item.unit = old_item.unit
      and item.rate_per_unit = old_item.rate_per_unit
      and item.estimated_subtotal = old_item.estimated_subtotal
      and item.created_at = old_item.created_at
      -- Validate actuals: if provided, must be non-negative and subtotal must match quantity * rate
      and (item.actual_quantity is null or item.actual_quantity >= 0)
      and (item.actual_rate is null or item.actual_rate >= 0)
      and (
        item.actual_subtotal is null
        or (
          item.actual_quantity is not null
          and item.actual_rate is not null
          and (
            item.actual_subtotal = pg_catalog.round(item.actual_quantity * item.actual_rate, 2)
            or item.actual_subtotal = pg_catalog.round(item.actual_quantity * item.actual_rate, 0)
          )
        )
      )
    );
  end if;

  return false;
end;
$$ language plpgsql security definer stable
set search_path = '';

-- 7. UPDATE BOOKING ITEMS RLS POLICIES
-- Drops legacy name "booking_items_update_delete" and binds UPDATE to is_valid_booking_item_update.
-- Dealer weighing updates are permitted ONLY before collected_weighed (during on_the_way or in_progress).
-- Preserves booking_items_delete completely untouched.
drop policy if exists "booking_items_update_delete" on public.booking_items;
drop policy if exists "booking_items_update" on public.booking_items;
create policy "booking_items_update"
  on public.booking_items for update
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_items.booking_id
        and (
          (b.customer_id = auth.uid() and b.status = 'requested')
          or (b.assigned_dealer_id = public.current_dealer_id() and b.status in ('on_the_way', 'in_progress'))
          or public.is_admin()
        )
    )
  )
  with check (
    public.is_admin()
    or public.is_valid_booking_item_update(booking_items)
  );

-- 8. UPDATE BOOKING STATUS HISTORY READ POLICY
-- Ensures verified dealers can read audit notes for unassigned requested marketplace bookings
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
            and b.assigned_dealer_id is null
            and public.is_verified_dealer()
          )
          or public.is_admin()
        )
    )
  );

-- 9. STATUS HISTORY AUDIT TRIGGER
-- Safely resolves dealer user_id to prevent foreign key violation on actor_id references auth.users(id)
create or replace function public.log_booking_status_transition()
returns trigger as $$
declare
  v_note text;
  v_dealer_user_id uuid;
begin
  if (tg_op = 'INSERT') then
    insert into public.booking_status_history (
      booking_id,
      old_status,
      new_status,
      actor_id,
      note
    ) values (
      new.id,
      null,
      new.status,
      coalesce(auth.uid(), new.customer_id),
      'Booking request created.'
    );
  elsif (old.status is distinct from new.status) then
    -- Resolve dealer user_id from public.dealers to satisfy foreign key constraint on auth.users(id)
    if new.assigned_dealer_id is not null then
      select user_id into v_dealer_user_id
      from public.dealers
      where id = new.assigned_dealer_id;
    end if;

    v_note := case
      when new.status = 'dealer_assigned' then
        'Collection dealer partner assigned.'
      when new.status = 'scheduled' then
        coalesce(
          'Pickup scheduled for ' || pg_catalog.to_char(coalesce(new.scheduled_date, new.preferred_date), 'DD Mon YYYY') || coalesce(' (' || coalesce(new.scheduled_time_slot, new.time_slot) || ')', ''),
          'Pickup scheduled by dealer partner.'
        )
      when new.status = 'on_the_way' or (new.status = 'in_progress' and old.status = 'scheduled') then
        case
          when new.driver_note is not null and pg_catalog.length(pg_catalog.btrim(new.driver_note)) > 0 then
            'Dealer is on the way. Note: ' || new.driver_note
          else
            'Dealer partner is on the way to the pickup address.'
        end
      when new.status = 'collected_weighed' then
        case
          when new.actual_total is not null then
            'Scrap collected and weighed on digital scale. Verified Total: ₹' || new.actual_total::text
          else
            'Scrap collected and verified on electronic weighing scale.'
        end
      when new.status = 'payment_completed' then
        coalesce(
          'Payment completed via ' || pg_catalog.upper(coalesce(new.payment_method, 'UPI')) || ' (₹' || coalesce(new.payment_amount, new.actual_total, new.estimated_total)::text || ').' ||
          case when new.payment_reference is not null and pg_catalog.length(pg_catalog.btrim(new.payment_reference)) > 0 then ' Ref: ' || new.payment_reference else '' end,
          'Payment completed.'
        )
      when new.status = 'completed' then
        'Doorstep pickup completed and scrap collected for certified recycling.'
      when new.status = 'rescheduled' then
        'Pickup rescheduled. Reason: ' || coalesce(new.reschedule_reason, 'Timing adjusted') ||
        case when new.rescheduled_date is not null then ' (Proposed: ' || pg_catalog.to_char(new.rescheduled_date, 'DD Mon YYYY') || ' ' || coalesce(new.rescheduled_time_slot, '') || ')' else '' end
      when new.status = 'cancelled' then
        'Pickup cancelled. Reason: ' || coalesce(new.cancellation_reason, 'Cancelled by user.')
      else
        'Status updated from ' || coalesce(old.status::text, 'unknown') || ' to ' || new.status::text || '.'
    end;

    insert into public.booking_status_history (
      booking_id,
      old_status,
      new_status,
      actor_id,
      note
    ) values (
      new.id,
      old.status,
      new.status,
      coalesce(auth.uid(), v_dealer_user_id, new.customer_id),
      v_note
    );
  end if;
  return new;
end;
$$ language plpgsql security definer
set search_path = '';

-- Ensure single canonical trigger is registered and eliminate any duplicate trigger variants
drop trigger if exists trigger_log_booking_status_transition on public.bookings;
drop trigger if exists trigger_log_booking_status on public.bookings;
create trigger trigger_log_booking_status
  after insert or update on public.bookings
  for each row execute procedure public.log_booking_status_transition();

-- 10. EXPLICIT EXECUTE PRIVILEGES
revoke execute on function public.is_verified_dealer() from public, anon;
grant execute on function public.is_verified_dealer() to authenticated;

revoke execute on function public.is_valid_booking_cancellation(public.bookings) from public, anon;
grant execute on function public.is_valid_booking_cancellation(public.bookings) to authenticated;

revoke execute on function public.is_valid_dealer_booking_update(public.bookings) from public, anon;
grant execute on function public.is_valid_dealer_booking_update(public.bookings) to authenticated;

revoke execute on function public.is_valid_booking_item_update(public.booking_items) from public, anon;
grant execute on function public.is_valid_booking_item_update(public.booking_items) to authenticated;
