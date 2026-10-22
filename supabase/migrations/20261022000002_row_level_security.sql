-- ====================================================================
-- Urban Scrap Database Migration: 000002_row_level_security.sql
-- Description: Row Level Security (RLS) policies and explicit GRANTs
-- Safe to run and re-run idempotently.
-- ====================================================================

-- Drop obsolete helper if previously created
drop function if exists public.is_valid_status_history_insert(text, public.booking_status, public.booking_status, uuid);

-- Helper function to check if current user is admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer stable;

-- Helper function to get dealer ID for current user
create or replace function public.current_dealer_id()
returns uuid as $$
declare
  d_id uuid;
begin
  select id into d_id
  from public.dealers
  where user_id = auth.uid()
  limit 1;
  return d_id;
end;
$$ language plpgsql security definer stable;

-- Helper function: Verify profile update is valid without triggering RLS recursion
-- Prevents authenticated users from altering their role
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

  -- Non-admin cannot alter their role
  return (old_p.role = p.role);
end;
$$ language plpgsql security definer stable;

-- Helper function: Verify dealer updates without recursive RLS queries on public.dealers
-- Prevents non-admin dealers from altering is_verified or rating
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

  -- Non-admin cannot alter verification status or rating
  return (
    old_d.is_verified is not distinct from d.is_verified
    and old_d.rating is not distinct from d.rating
  );
end;
$$ language plpgsql security definer stable;

-- Helper function: Verify customer cancellation without allowing edits to other booking fields
-- Confirmed exact column match with migration 000001 public.bookings
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

  -- Must be customer's booking
  if old_b.customer_id != auth.uid() or b.customer_id != auth.uid() then
    return false;
  end if;

  -- Only cancellable from requested or dealer_assigned status
  if old_b.status not in ('requested', 'dealer_assigned') then
    return false;
  end if;

  -- Target status must be cancelled
  if b.status != 'cancelled' then
    return false;
  end if;

  -- Strict Field Preservation: All other booking columns must remain completely unchanged
  return (
    old_b.id = b.id
    and old_b.customer_id = b.customer_id
    and old_b.assigned_dealer_id is not distinct from b.assigned_dealer_id
    and old_b.estimated_total = b.estimated_total
    and old_b.customer_name = b.customer_name
    and old_b.phone_number = b.phone_number
    and (old_b.email is not distinct from b.email)
    and old_b.street_address = b.street_address
    and old_b.area = b.area
    and old_b.city = b.city
    and old_b.pincode = b.pincode
    and old_b.preferred_date = b.preferred_date
    and old_b.time_slot = b.time_slot
    and (old_b.notes is not distinct from b.notes)
    and old_b.created_at = b.created_at
  );
end;
$$ language plpgsql security definer stable;

-- Helper function: Verify dealer booking claiming or status progression
-- Confirmed exact column match with migration 000001 public.bookings
-- Strictly preserves every booking column except permitted status and assigned_dealer_id
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

  if c_dealer_id is null or dealer_is_verified is not true then
    return false;
  end if;

  select * into old_b
  from public.bookings
  where id = b.id;

  if not found then
    return false;
  end if;

  -- Strict Field Preservation:
  -- Dealer updates must preserve EVERY booking column except permitted status and assigned_dealer_id
  if old_b.id != b.id
     or old_b.customer_id != b.customer_id
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

  -- Case 1: Claiming an unassigned requested booking
  if old_b.status = 'requested' and old_b.assigned_dealer_id is null then
    return (b.status = 'dealer_assigned' and b.assigned_dealer_id = c_dealer_id);
  end if;

  -- Case 2: Progressing status of an already assigned booking
  if old_b.assigned_dealer_id = c_dealer_id and b.assigned_dealer_id = c_dealer_id then
    return (
      (old_b.status = 'dealer_assigned' and b.status = 'in_progress')
      or (old_b.status = 'in_progress' and b.status = 'completed')
    );
  end if;

  return false;
end;
$$ language plpgsql security definer stable;

-- ====================================================================
-- Server-Side Status History Audit Trigger
-- History is automatically generated by this trigger; clients cannot fabricate logs
-- ====================================================================
create or replace function public.log_booking_status_transition()
returns trigger as $$
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
      coalesce(auth.uid(), new.assigned_dealer_id, new.customer_id),
      case
        when new.status = 'cancelled' then 'Booking cancelled by customer.'
        when new.status = 'dealer_assigned' then 'Booking claimed by scrap collection partner.'
        when new.status = 'in_progress' then 'Partner en route for doorstep pickup.'
        when new.status = 'completed' then 'Pickup and digital payout completed.'
        else 'Status transitioned from ' || old.status || ' to ' || new.status || '.'
      end
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_log_booking_status on public.bookings;
create trigger trigger_log_booking_status
  after insert or update on public.bookings
  for each row execute procedure public.log_booking_status_transition();

-- ====================================================================
-- 1. PROFILES RLS
-- ====================================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_admin()
    or id in (
      -- Dealer can view customer profile name for assigned bookings
      select customer_id from public.bookings
      where assigned_dealer_id = public.current_dealer_id()
    )
  );

-- Profile creation is strictly reserved for the trusted signup trigger or admin
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
  on public.profiles for insert
  with check (public.is_admin());

-- Users can update their own details (name, phone), but cannot change their role
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or public.is_valid_profile_update(profiles)
  );

-- Only admins can delete profiles; regular users cannot delete their profile
drop policy if exists "profiles_delete_admin_or_self" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete
  using (public.is_admin());

-- ====================================================================
-- 2. MATERIALS RLS
-- ====================================================================
alter table public.materials enable row level security;

drop policy if exists "materials_select_active_public" on public.materials;
create policy "materials_select_active_public"
  on public.materials for select
  using (is_active = true or public.is_admin());

drop policy if exists "materials_insert_admin" on public.materials;
create policy "materials_insert_admin"
  on public.materials for insert
  with check (public.is_admin());

drop policy if exists "materials_update_admin" on public.materials;
create policy "materials_update_admin"
  on public.materials for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "materials_delete_admin" on public.materials;
create policy "materials_delete_admin"
  on public.materials for delete
  using (public.is_admin());

-- ====================================================================
-- 3. DEALERS RLS
-- ====================================================================
alter table public.dealers enable row level security;

drop policy if exists "dealers_select_policy" on public.dealers;
create policy "dealers_select_policy"
  on public.dealers for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      is_verified = true
      and id in (
        select assigned_dealer_id from public.bookings
        where customer_id = auth.uid()
      )
    )
  );

drop policy if exists "dealers_insert_policy" on public.dealers;
create policy "dealers_insert_policy"
  on public.dealers for insert
  with check (
    (user_id = auth.uid() and is_verified = false)
    or public.is_admin()
  );

-- Safe update policy without recursive subqueries on public.dealers
drop policy if exists "dealers_update_policy" on public.dealers;
create policy "dealers_update_policy"
  on public.dealers for update
  using (user_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or public.is_valid_dealer_update(dealers)
  );

drop policy if exists "dealers_delete_admin" on public.dealers;
create policy "dealers_delete_admin"
  on public.dealers for delete
  using (public.is_admin());

-- ====================================================================
-- 4. BOOKINGS RLS
-- ====================================================================
alter table public.bookings enable row level security;

drop policy if exists "bookings_select_policy" on public.bookings;
create policy "bookings_select_policy"
  on public.bookings for select
  using (
    customer_id = auth.uid()
    or assigned_dealer_id = public.current_dealer_id()
    or (
      status = 'requested'
      and exists (
        select 1 from public.dealers d
        where d.user_id = auth.uid() and d.is_verified = true
      )
    )
    or public.is_admin()
  );

-- Customer can create only their own booking with status 'requested' and assigned_dealer_id null
drop policy if exists "bookings_insert_customer" on public.bookings;
create policy "bookings_insert_customer"
  on public.bookings for insert
  with check (
    public.is_admin()
    or (
      customer_id = auth.uid()
      and status = 'requested'
      and assigned_dealer_id is null
    )
  );

drop policy if exists "bookings_update_policy" on public.bookings;
create policy "bookings_update_policy"
  on public.bookings for update
  using (
    customer_id = auth.uid()
    or assigned_dealer_id = public.current_dealer_id()
    or (
      status = 'requested'
      and exists (
        select 1 from public.dealers d
        where d.user_id = auth.uid() and d.is_verified = true
      )
    )
    or public.is_admin()
  )
  with check (
    public.is_admin()
    or (
      -- Customer cancellation constraint: only status may be changed to 'cancelled'
      public.is_valid_booking_cancellation(bookings)
    )
    or (
      -- Dealer claiming or status progression: only status and assigned_dealer_id may change
      public.is_valid_dealer_booking_update(bookings)
    )
  );

drop policy if exists "bookings_delete_admin" on public.bookings;
create policy "bookings_delete_admin"
  on public.bookings for delete
  using (public.is_admin());

-- ====================================================================
-- 5. BOOKING ITEMS RLS
-- ====================================================================
alter table public.booking_items enable row level security;

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
            and exists (
              select 1 from public.dealers d
              where d.user_id = auth.uid() and d.is_verified = true
            )
          )
          or public.is_admin()
        )
    )
  );

-- Booking items can only be inserted while the parent booking is in 'requested' status
drop policy if exists "booking_items_insert" on public.booking_items;
create policy "booking_items_insert"
  on public.booking_items for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_items.booking_id
        and b.customer_id = auth.uid()
        and b.status = 'requested'
    )
  );

drop policy if exists "booking_items_update_delete" on public.booking_items;
create policy "booking_items_update_delete"
  on public.booking_items for update
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_items.booking_id
        and (
          (b.customer_id = auth.uid() and b.status = 'requested')
          or public.is_admin()
        )
    )
  );

drop policy if exists "booking_items_delete" on public.booking_items;
create policy "booking_items_delete"
  on public.booking_items for delete
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_items.booking_id
        and (
          (b.customer_id = auth.uid() and b.status = 'requested')
          or public.is_admin()
        )
    )
  );

-- ====================================================================
-- 6. BOOKING STATUS HISTORY RLS
-- Server-generated via database trigger; direct client inserts are blocked
-- ====================================================================
alter table public.booking_status_history enable row level security;

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
          or public.is_admin()
        )
    )
  );

-- Direct client inserts are blocked. Only admins can insert manually.
-- All standard audit entries are server-generated by trigger_log_booking_status.
drop policy if exists "booking_status_history_insert" on public.booking_status_history;
create policy "booking_status_history_insert"
  on public.booking_status_history for insert
  with check (public.is_admin());

drop policy if exists "booking_status_history_update_delete" on public.booking_status_history;
create policy "booking_status_history_update_delete"
  on public.booking_status_history for all
  using (public.is_admin())
  with check (public.is_admin());

-- ====================================================================
-- 7. EXPLICIT ROLE GRANTS
-- Crucial when "Automatically expose new tables to API" is disabled
-- ====================================================================

-- 1. Schema access
grant usage on schema public to anon, authenticated;

-- 2. Public / Anonymous table grants
-- Visitors need to view active scrap rates without signing in
grant select on public.materials to anon, authenticated;

-- 3. Authenticated user grants (Customer, Dealer, Admin)
-- PostgREST routes data through RLS policies defined above
grant select, update on public.profiles to authenticated;
grant insert, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.dealers to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.booking_items to authenticated;
-- Authenticated users can read booking status history, but CANNOT insert/update/delete directly
grant select on public.booking_status_history to authenticated;

-- 4. Function execution privileges
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.current_dealer_id() to authenticated;
grant execute on function public.is_valid_profile_update(public.profiles) to authenticated;
grant execute on function public.is_valid_dealer_update(public.dealers) to authenticated;
grant execute on function public.is_valid_booking_cancellation(public.bookings) to authenticated;
grant execute on function public.is_valid_dealer_booking_update(public.bookings) to authenticated;

-- 5. Sequences
grant usage, select on all sequences in schema public to authenticated;
