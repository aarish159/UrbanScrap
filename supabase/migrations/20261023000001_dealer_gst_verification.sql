-- ====================================================================
-- Urban Scrap Database Migration: 20261023000001_dealer_gst_verification.sql
-- Description: Dealer GST verification schema, audit reviews, RLS policies,
--              and secure document storage setup.
-- Safe and idempotent to run on Supabase.
-- ====================================================================

-- 1. ADD GST & VERIFICATION COLUMNS TO PUBLIC.DEALERS
alter table public.dealers
  add column if not exists gstin text,
  add column if not exists legal_business_name text,
  add column if not exists business_address text,
  add column if not exists state text,
  add column if not exists gst_certificate_url text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists submitted_at timestamptz default now();

-- Ensure constraints on GSTIN format and verification status
do $$ begin
  alter table public.dealers
    add constraint dealers_gstin_format_check
    check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table public.dealers
    add constraint dealers_verification_status_check
    check (verification_status in ('pending', 'approved', 'rejected'));
exception
  when duplicate_object then null;
end $$;

-- Synchronize existing records (if is_verified = true, set status = 'approved')
update public.dealers
set verification_status = case when is_verified = true then 'approved' else 'pending' end
where verification_status is null or verification_status not in ('pending', 'approved', 'rejected');

-- 2. CREATE DEALER REVIEWS AUDIT HISTORY TABLE
create table if not exists public.dealer_reviews (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('submitted', 'resubmitted', 'approved', 'rejected')),
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_dealers_gstin on public.dealers(gstin);
create index if not exists idx_dealers_verification_status on public.dealers(verification_status);
create index if not exists idx_dealer_reviews_dealer on public.dealer_reviews(dealer_id);
create index if not exists idx_dealer_reviews_created on public.dealer_reviews(created_at desc);

-- 3. UPGRADE IS_VALID_DEALER_UPDATE TO ENFORCE STRICT SERVER-SIDE AUTHORIZATION
-- Prevents dealers from approving their own application, setting is_verified = true,
-- or forging administrative reviewer metadata.
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

  -- STRICT SECURITY CONSTRAINT:
  -- Non-admin dealer CANNOT set is_verified to true or verification_status to 'approved'
  if d.is_verified = true or d.verification_status = 'approved' then
    return false;
  end if;

  -- Non-admin dealer CANNOT alter rating or forge administrative audit metadata
  if old_d.rating is distinct from d.rating or
     (d.reviewed_by is not null and old_d.reviewed_by is distinct from d.reviewed_by) or
     (d.reviewed_at is not null and old_d.reviewed_at is distinct from d.reviewed_at) then
    return false;
  end if;

  return true;
end;
$$ language plpgsql security definer stable;

-- 4. ROW LEVEL SECURITY ON DEALER REVIEWS TABLE
alter table public.dealer_reviews enable row level security;

-- Admin has full access to view and create review audit records
drop policy if exists "dealer_reviews_admin_all" on public.dealer_reviews;
create policy "dealer_reviews_admin_all" on public.dealer_reviews
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Dealers can view reviews of their own business
drop policy if exists "dealer_reviews_dealer_select" on public.dealer_reviews;
create policy "dealer_reviews_dealer_select" on public.dealer_reviews
  for select to authenticated
  using (dealer_id = public.current_dealer_id());

-- Dealers can log submission/resubmission events for their own record
drop policy if exists "dealer_reviews_dealer_insert" on public.dealer_reviews;
create policy "dealer_reviews_dealer_insert" on public.dealer_reviews
  for insert to authenticated
  with check (
    dealer_id = public.current_dealer_id()
    and action in ('submitted', 'resubmitted')
  );

-- 5. STORAGE BUCKET CONFIGURATION FOR GST CERTIFICATES
-- Creates private bucket 'dealer-documents' if not present
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dealer-documents',
  'dealer-documents',
  false,
  5242880, -- 5 MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Storage RLS: Authenticated dealers can upload their certificates into their own folder
drop policy if exists "dealer_documents_upload_own" on storage.objects;
create policy "dealer_documents_upload_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dealer-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: Admins can view all certificates; Dealers can view their own
drop policy if exists "dealer_documents_select_access" on storage.objects;
create policy "dealer_documents_select_access" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dealer-documents'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- Storage RLS: Admins and owners can update/delete
drop policy if exists "dealer_documents_manage_access" on storage.objects;
create policy "dealer_documents_manage_access" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'dealer-documents'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- Explicit GRANTS
grant select, insert, update on public.dealers to authenticated;
grant select, insert on public.dealer_reviews to authenticated;

-- ====================================================================
-- INITIAL ADMIN CREATION INSTRUCTIONS:
-- Run this in the Supabase Dashboard SQL Editor to designate the first admin:
--
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your-admin@example.com');
-- ====================================================================
