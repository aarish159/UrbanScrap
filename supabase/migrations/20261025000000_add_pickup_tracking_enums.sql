-- ====================================================================
-- Urban Scrap Database Migration: 20261025000000_add_pickup_tracking_enums.sql
-- Description: Extend booking_status enum with order tracking states.
-- Note: Must be executed and committed in its own transaction prior to
--       any queries or DDL that reference the new enum values, avoiding
--       PostgreSQL transaction restriction 55P04.
-- ====================================================================

-- 1. EXTEND BOOKING STATUS ENUM
-- Idempotent enum value additions for pickup tracking workflow:
alter type public.booking_status add value if not exists 'scheduled';
alter type public.booking_status add value if not exists 'on_the_way';
alter type public.booking_status add value if not exists 'collected_weighed';
alter type public.booking_status add value if not exists 'payment_completed';
alter type public.booking_status add value if not exists 'rescheduled';
