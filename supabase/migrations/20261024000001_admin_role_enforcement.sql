-- ====================================================================
-- Urban Scrap Database Migration: 20261024000001_admin_role_enforcement.sql
-- Description: Trusted administrative role management, escalation prevention,
--              and secure procedures to promote existing accounts to Admin.
-- Safe and idempotent to run on Supabase.
-- ====================================================================

-- 1. ENHANCE IS_ADMIN FUNCTION
-- Returns true if current session is postgres, service_role, or has role = 'admin' in public.profiles
create or replace function public.is_admin()
returns boolean as $$
begin
  -- Bypass check for direct database admin / service_role
  if auth.role() = 'service_role' then
    return true;
  end if;

  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'::public.user_role
  );
end;
$$ language plpgsql security definer stable;

-- 2. ENFORCE SERVER-SIDE ROLE ESCALATION PREVENTION
-- Blocks any client-side user from altering their own role in public.profiles
create or replace function public.prevent_role_escalation()
returns trigger as $$
begin
  if (old.role is distinct from new.role) then
    -- When running directly in Supabase SQL Editor (auth.role() is null)
    -- or server-side background worker with service_role key:
    if auth.role() is null or auth.role() = 'service_role' then
      return new;
    end if;

    -- If executed via authenticated client API, caller MUST already be an admin
    if not public.is_admin() then
      raise exception 'Unauthorized: Account role cannot be changed by non-administrators.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Re-attach trigger on public.profiles
drop trigger if exists check_role_escalation on public.profiles;
create trigger check_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_role_escalation();

-- 3. TRUSTED STORED PROCEDURE: GRANT ADMIN ROLE BY EMAIL
-- Safely promotes an existing authenticated account to admin role.
-- Security: Only callable by postgres, service_role, or an existing admin.
create or replace function public.grant_admin_role(target_email text)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role public.user_role,
  updated_at timestamptz
) as $$
declare
  target_user_id uuid;
  user_full_name text;
  clean_email text;
begin
  -- Authorization guard: Prevent regular users from self-promoting through client RPC
  if auth.role() is not null and auth.role() != 'service_role' and not public.is_admin() then
    raise exception 'Unauthorized: Only system administrators can grant admin privileges.';
  end if;

  clean_email := lower(trim(target_email));
  if clean_email = '' or clean_email is null then
    raise exception 'Target email cannot be empty.';
  end if;

  -- 1. Locate registered account in auth.users
  select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Admin User')
  into target_user_id, user_full_name
  from auth.users u
  where lower(u.email) = clean_email
  limit 1;

  if target_user_id is null then
    raise exception 'No registered user found with email "%". The user must create an account first before receiving admin access.', clean_email;
  end if;

  -- 2. Upsert profile with admin role
  insert into public.profiles (id, full_name, role, updated_at)
  values (target_user_id, user_full_name, 'admin'::public.user_role, now())
  on conflict (id) do update set
    role = 'admin'::public.user_role,
    updated_at = now();

  -- 3. Return confirmation record
  return query
  select p.id as user_id, clean_email as email, p.full_name, p.role, p.updated_at
  from public.profiles p
  where p.id = target_user_id;
end;
$$ language plpgsql security definer;

-- 4. TRUSTED STORED PROCEDURE: GRANT ADMIN ROLE BY PHONE
-- Safely promotes an existing authenticated account by phone number.
-- Security: Only callable by postgres, service_role, or an existing admin.
create or replace function public.grant_admin_role_by_phone(target_phone text)
returns table (
  user_id uuid,
  phone text,
  full_name text,
  role public.user_role,
  updated_at timestamptz
) as $$
declare
  target_user_id uuid;
  user_full_name text;
  clean_phone text;
  e164_phone text;
begin
  -- Authorization guard: Prevent regular users from self-promoting through client RPC
  if auth.role() is not null and auth.role() != 'service_role' and not public.is_admin() then
    raise exception 'Unauthorized: Only system administrators can grant admin privileges.';
  end if;

  clean_phone := regexp_replace(target_phone, '\D', '', 'g');
  if length(clean_phone) < 10 then
    raise exception 'Invalid phone number: must contain at least 10 digits.';
  end if;

  if length(clean_phone) = 12 and clean_phone like '91%' then
    e164_phone := '+' || clean_phone;
    clean_phone := substring(clean_phone from 3);
  else
    clean_phone := right(clean_phone, 10);
    e164_phone := '+91' || clean_phone;
  end if;

  -- 1. Locate account in auth.users or profiles
  select u.id, coalesce(u.raw_user_meta_data->>'full_name', 'Admin User')
  into target_user_id, user_full_name
  from auth.users u
  where u.phone = e164_phone or u.phone like '%' || clean_phone
  limit 1;

  if target_user_id is null then
    select p.id, p.full_name
    into target_user_id, user_full_name
    from public.profiles p
    where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || clean_phone
    limit 1;
  end if;

  if target_user_id is null then
    raise exception 'No registered user found with phone ending in "%". Please ensure the user has created an account first.', clean_phone;
  end if;

  -- 2. Upsert profile with admin role
  insert into public.profiles (id, full_name, phone, phone_verified, role, updated_at)
  values (target_user_id, user_full_name, clean_phone, true, 'admin'::public.user_role, now())
  on conflict (id) do update set
    role = 'admin'::public.user_role,
    phone_verified = true,
    updated_at = now();

  -- 3. Return confirmation record
  return query
  select p.id as user_id, clean_phone as phone, p.full_name, p.role, p.updated_at
  from public.profiles p
  where p.id = target_user_id;
end;
$$ language plpgsql security definer;

-- 5. TRUSTED STORED PROCEDURE: REVOKE ADMIN ROLE
create or replace function public.revoke_admin_role(target_email text)
returns boolean as $$
declare
  clean_email text;
  target_user_id uuid;
begin
  if auth.role() is not null and auth.role() != 'service_role' and not public.is_admin() then
    raise exception 'Unauthorized: Only system administrators can revoke admin privileges.';
  end if;

  clean_email := lower(trim(target_email));
  select id into target_user_id from auth.users where lower(email) = clean_email limit 1;

  if target_user_id is null then
    return false;
  end if;

  update public.profiles
  set role = 'customer'::public.user_role, updated_at = now()
  where id = target_user_id;

  return true;
end;
$$ language plpgsql security definer;

-- 6. STRICT PERMISSIONS ON ADMIN FUNCTIONS
revoke execute on function public.grant_admin_role(text) from public, anon;
grant execute on function public.grant_admin_role(text) to authenticated, service_role, postgres;

revoke execute on function public.grant_admin_role_by_phone(text) from public, anon;
grant execute on function public.grant_admin_role_by_phone(text) to authenticated, service_role, postgres;

revoke execute on function public.revoke_admin_role(text) from public, anon;
grant execute on function public.revoke_admin_role(text) to authenticated, service_role, postgres;
