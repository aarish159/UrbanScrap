-- ====================================================================
-- Urban Scrap Database Migration: 000001_initial_schema.sql
-- Description: Core tables, enums, constraints, indexes, and triggers
-- ====================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. ENUMS
do $$ begin
  create type user_role as enum ('customer', 'dealer', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type material_category as enum ('paper', 'plastic', 'metal', 'ewaste');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type booking_status as enum (
    'requested',
    'dealer_assigned',
    'in_progress',
    'completed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

-- 2. PROFILES TABLE
-- Linked directly to Supabase auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  phone text,
  phone_verified boolean not null default false,
  role user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. MATERIALS TABLE
-- Indicative sample rate card catalogue
create table if not exists public.materials (
  id text primary key,
  name text not null,
  category material_category not null,
  indicative_rate numeric(10, 2) not null check (indicative_rate >= 0),
  unit text not null check (unit in ('kg', 'piece')),
  description text not null default '',
  popular boolean not null default false,
  min_quantity numeric(10, 2) not null default 1 check (min_quantity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. DEALERS TABLE
-- Partner profile linked to auth user with business verification state
create table if not exists public.dealers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  business_name text not null,
  phone text not null,
  service_area text not null,
  vehicle_type text not null default 'EV Loader / Three-Wheeler',
  rating numeric(3, 2) not null default 4.80 check (rating between 1.00 and 5.00),
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. BOOKINGS TABLE
-- Customer doorstep scrap pickup requests
create table if not exists public.bookings (
  id text primary key, -- e.g. 'US-2026-9481'
  customer_id uuid not null references auth.users(id) on delete restrict,
  assigned_dealer_id uuid references public.dealers(id) on delete set null,
  status booking_status not null default 'requested',
  estimated_total numeric(12, 2) not null default 0 check (estimated_total >= 0),
  
  -- Doorstep pickup location & contact
  customer_name text not null,
  phone_number text not null check (char_length(regexp_replace(phone_number, '\D', '', 'g')) = 10),
  email text,
  street_address text not null,
  area text not null,
  city text not null,
  pincode text not null check (char_length(regexp_replace(pincode, '\D', '', 'g')) = 6),
  preferred_date date not null,
  time_slot text not null,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. BOOKING ITEMS TABLE
-- Material line items associated with each booking
create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null references public.bookings(id) on delete cascade,
  material_id text not null references public.materials(id) on delete restrict,
  material_name text not null,
  category material_category not null,
  quantity numeric(10, 2) not null check (quantity > 0),
  unit text not null check (unit in ('kg', 'piece')),
  rate_per_unit numeric(10, 2) not null check (rate_per_unit >= 0),
  estimated_subtotal numeric(12, 2) not null check (estimated_subtotal >= 0),
  created_at timestamptz not null default now()
);

-- 7. BOOKING STATUS HISTORY TABLE
-- Audit log of status transitions
create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null references public.bookings(id) on delete cascade,
  old_status booking_status,
  new_status booking_status not null,
  actor_id uuid references auth.users(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- 8. INDEXES FOR PERFORMANCE
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_dealers_user_id on public.dealers(user_id);
create index if not exists idx_dealers_verified on public.dealers(is_verified);
create index if not exists idx_bookings_customer on public.bookings(customer_id);
create index if not exists idx_bookings_assigned_dealer on public.bookings(assigned_dealer_id);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_created on public.bookings(created_at desc);
create index if not exists idx_booking_items_booking on public.booking_items(booking_id);
create index if not exists idx_booking_status_history_booking on public.booking_status_history(booking_id);

-- 9. TRIGGERS & FUNCTIONS

-- A. Auto-update updated_at timestamps
create or replace function public.trigger_set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_profiles on public.profiles;
create trigger set_timestamp_profiles
  before update on public.profiles
  for each row execute procedure public.trigger_set_timestamp();

drop trigger if exists set_timestamp_materials on public.materials;
create trigger set_timestamp_materials
  before update on public.materials
  for each row execute procedure public.trigger_set_timestamp();

drop trigger if exists set_timestamp_dealers on public.dealers;
create trigger set_timestamp_dealers
  before update on public.dealers
  for each row execute procedure public.trigger_set_timestamp();

drop trigger if exists set_timestamp_bookings on public.bookings;
create trigger set_timestamp_bookings
  before update on public.bookings
  for each row execute procedure public.trigger_set_timestamp();

-- B. Prevent unauthorized role elevation from frontend
create or replace function public.prevent_role_escalation()
returns trigger as $$
begin
  if (old.role is distinct from new.role) then
    -- When running SQL directly in the Supabase SQL Editor / database dashboard,
    -- there is no Supabase JWT session, so auth.role() IS NULL. Allow this!
    if auth.role() is null then
      return new;
    end if;

    -- If executed through client API (authenticated / anon), caller MUST be an existing admin
    if not exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    ) then
      raise exception 'Unauthorized: Account role cannot be changed.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists check_role_escalation on public.profiles;
create trigger check_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_role_escalation();

-- C. Automatically create user profile when user registers via Supabase Auth
-- Security Rule: New signups MUST ALWAYS get the 'customer' role.
-- Never parse or trust any role sent in raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  parsed_name text;
  parsed_phone text;
begin
  parsed_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'User');
  parsed_phone := new.raw_user_meta_data->>'phone';

  insert into public.profiles (id, full_name, phone, phone_verified, role)
  values (
    new.id,
    parsed_name,
    parsed_phone,
    false,
    'customer'::public.user_role
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = coalesce(excluded.phone, public.profiles.phone);

  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution on auth.users table
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- D. Server-side Rate Verification & Subtotal Enforcement
-- Ensures prices submitted by client cannot be forged/tampered with
create or replace function public.verify_and_calculate_booking_item()
returns trigger as $$
declare
  active_rate numeric(10, 2);
  active_name text;
  active_category public.material_category;
  active_unit text;
begin
  -- Fetch canonical material details directly from materials catalogue table
  select indicative_rate, name, category, unit
  into active_rate, active_name, active_category, active_unit
  from public.materials
  where id = new.material_id and is_active = true;

  if not found then
    raise exception 'Material ID % is inactive or does not exist.', new.material_id;
  end if;

  -- Overwrite with server-verified values
  new.material_name := active_name;
  new.category := active_category;
  new.unit := active_unit;
  new.rate_per_unit := active_rate;
  new.estimated_subtotal := round(new.quantity * active_rate, 2);

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_booking_item_rate on public.booking_items;
create trigger enforce_booking_item_rate
  before insert or update on public.booking_items
  for each row execute procedure public.verify_and_calculate_booking_item();

-- E. Recalculate Booking Total on items insert, update, or delete
create or replace function public.recalculate_booking_total()
returns trigger as $$
declare
  target_booking_id text;
  new_total numeric(12, 2);
begin
  if (tg_op = 'DELETE') then
    target_booking_id := old.booking_id;
  else
    target_booking_id := new.booking_id;
  end if;

  select coalesce(sum(estimated_subtotal), 0)
  into new_total
  from public.booking_items
  where booking_id = target_booking_id;

  update public.bookings
  set estimated_total = new_total
  where id = target_booking_id;

  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_recalculate_booking_total on public.booking_items;
create trigger trigger_recalculate_booking_total
  after insert or update or delete on public.booking_items
  for each row execute procedure public.recalculate_booking_total();

-- F. Automatic Booking Status History Audit Trail
create or replace function public.log_booking_status_transition()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.booking_status_history (booking_id, old_status, new_status, actor_id, note)
    values (
      new.id,
      null,
      new.status,
      coalesce(auth.uid(), new.customer_id),
      'Booking request created.'
    );
  elsif (old.status is distinct from new.status) then
    insert into public.booking_status_history (booking_id, old_status, new_status, actor_id, note)
    values (
      new.id,
      old.status,
      new.status,
      auth.uid(),
      'Status transitioned from ' || old.status || ' to ' || new.status || '.'
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
-- G. Safe Admin & Dealer Promotion Helpers (SQL Editor / Superuser Only)
-- ====================================================================

-- Promotes a registered user to admin by email. Safe to run in Supabase SQL Editor.
create or replace function public.promote_user_to_admin(target_email text)
returns void as $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(trim(email)) = lower(trim(target_email));

  if target_user_id is null then
    raise exception 'User with email "%" does not exist in auth.users. Please sign up first.', target_email;
  end if;

  update public.profiles
  set role = 'admin'
  where id = target_user_id;
end;
$$ language plpgsql security definer;

-- Promotes a user to verified dealer by email (SQL Editor / Superuser Only)
create or replace function public.promote_user_to_dealer(
  target_email text,
  business_name text,
  phone text,
  service_area text,
  vehicle_type text default 'EV Loader / Three-Wheeler',
  rating numeric default 4.80,
  is_verified boolean default true
)
returns void as $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(trim(email)) = lower(trim(target_email));

  if target_user_id is null then
    raise exception 'User with email "%" does not exist in auth.users. Please sign up first.', target_email;
  end if;

  update public.profiles
  set role = 'dealer'
  where id = target_user_id;

  insert into public.dealers (
    user_id,
    business_name,
    phone,
    service_area,
    vehicle_type,
    rating,
    is_verified
  ) values (
    target_user_id,
    business_name,
    phone,
    service_area,
    vehicle_type,
    rating,
    is_verified
  )
  on conflict (user_id) do update set
    business_name = excluded.business_name,
    phone = excluded.phone,
    service_area = excluded.service_area,
    vehicle_type = excluded.vehicle_type,
    rating = excluded.rating,
    is_verified = excluded.is_verified,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- CRITICAL SECURITY: Revoke execution of promotion functions from public, anon, and authenticated
-- This guarantees normal users and browser clients can NEVER call these functions via RPC
revoke execute on function public.promote_user_to_admin(text) from public, anon, authenticated;
grant execute on function public.promote_user_to_admin(text) to service_role, postgres;

revoke execute on function public.promote_user_to_dealer(text, text, text, text, text, numeric, boolean) from public, anon, authenticated;
grant execute on function public.promote_user_to_dealer(text, text, text, text, text, numeric, boolean) to service_role, postgres;
