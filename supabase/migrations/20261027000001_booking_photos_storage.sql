-- ====================================================================
-- Urban Scrap Database Migration: 20261027000001_booking_photos_storage.sql
-- Description: Add photo_paths to public.bookings and configure private
--              'booking-photos' storage bucket with secure RLS policies.
-- Safe, non-destructive, and idempotent to run in Supabase SQL Editor.
-- ====================================================================

-- 1. ADD PHOTO_PATHS COLUMN TO BOOKINGS TABLE
alter table public.bookings
  add column if not exists photo_paths text[] default array[]::text[];

-- Index for array queries on photo_paths
create index if not exists idx_bookings_photo_paths on public.bookings using gin(photo_paths);

-- 2. STORAGE BUCKET CONFIGURATION FOR CUSTOMER BOOKING PHOTOS
-- Private bucket: only authorized customers, assigned/marketplace dealers, and admins can access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-photos',
  'booking-photos',
  false,
  5242880, -- 5 MB limit per photo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 3. SECURITY DEFINER HELPER: DEALER ACCESS CHECK FOR BOOKING PHOTOS
-- Allows verified dealers to view booking photos if:
--   a) The booking is assigned to their active verified dealer profile, OR
--   b) The booking is an unassigned request in the marketplace ('requested' status).
-- Uses SECURITY DEFINER to prevent cross-table RLS recursion between storage.objects and public.bookings.
create or replace function public.can_dealer_view_booking_photo(object_name text)
returns boolean as $$
declare
  target_booking_id text;
  v_dealer_id uuid;
begin
  if auth.uid() is null then
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

-- 4. STORAGE RLS POLICIES FOR 'booking-photos' BUCKET

-- Policy A: Customers can upload photos only into their own customer folder: <customer_id>/...
drop policy if exists "booking_photos_upload_customer" on storage.objects;
create policy "booking_photos_upload_customer" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'booking-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy B: Customers can clean up/delete their own uploaded files (e.g. if booking fails or photo replaced)
drop policy if exists "booking_photos_delete_own" on storage.objects;
create policy "booking_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'booking-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Policy C: SELECT access:
--   1. Customer who uploaded the photo (<customer_id> folder match)
--   2. Verified dealer reviewing the lead in marketplace or assigned pickup
--   3. Administrator
drop policy if exists "booking_photos_select_access" on storage.objects;
create policy "booking_photos_select_access" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'booking-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or public.can_dealer_view_booking_photo(name)
    )
  );
