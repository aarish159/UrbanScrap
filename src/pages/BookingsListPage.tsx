import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Plus,
  Database,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

import type { Booking, BookingStatus } from '../types';
import {
  getBookings,
  updateBookingStatus,
  subscribeToBookingChanges,
} from '../utils/storage';
import { formatINR, formatDate, formatDateTime, getStatusDetails } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useScrollAnimation } from '../utils/useScrollAnimation';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PickupTrackerTimeline } from '../components/tracking/PickupTrackerTimeline';

export const BookingsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { user, isConfigured } = useAuth();
  useScrollAnimation();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Fetch bookings function
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    if (isConfigured && isSupabaseConfigured() && user) {
      try {
        const { data, error } = await (supabase.from('bookings') as any)
          .select(`
            id,
            customer_name,
            phone_number,
            email,
            street_address,
            area,
            city,
            pincode,
            preferred_date,
            time_slot,
            scheduled_pickup_at,
            scheduled_date,
            scheduled_time_slot,
            notes,
            driver_note,
            status,
            estimated_total,
            actual_total,
            payment_method,
            payment_amount,
            payment_reference,
            cancellation_reason,
            reschedule_reason,
            rescheduled_date,
            rescheduled_time_slot,
            photo_paths,
            created_at,
            booking_items (
              id,
              material_id,
              material_name,
              category,
              quantity,
              unit,
              rate_per_unit,
              estimated_subtotal,
              actual_quantity,
              actual_rate,
              actual_subtotal
            ),
            dealers (
              id,
              business_name,
              phone,
              vehicle_type,
              is_verified,
              rating
            ),
            booking_status_history (
              id,
              new_status,
              note,
              created_at
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Supabase fetch failed, falling back to local state:', error.message);
          const all = getBookings();
          setBookings(all);
        } else if (data) {
          const mapped: Booking[] = (data as any[]).map((b) => ({
            id: b.id,
            createdAt: b.created_at,
            status: b.status as BookingStatus,
            estimatedTotal: Number(b.estimated_total),
            actualTotal: b.actual_total != null ? Number(b.actual_total) : undefined,
            scheduledPickupAt: b.scheduled_pickup_at || undefined,
            scheduledDate: b.scheduled_date || undefined,
            scheduledTimeSlot: b.scheduled_time_slot || undefined,
            paymentMethod: b.payment_method || undefined,
            paymentAmount: b.payment_amount != null ? Number(b.payment_amount) : undefined,
            paymentReference: b.payment_reference || undefined,
            driverNote: b.driver_note || undefined,
            cancellationReason: b.cancellation_reason || undefined,
            rescheduleReason: b.reschedule_reason || undefined,
            rescheduledDate: b.rescheduled_date || undefined,
            rescheduledTimeSlot: b.rescheduled_time_slot || undefined,
            address: {
              fullName: b.customer_name,
              phoneNumber: b.phone_number,
              email: b.email || undefined,
              streetAddress: b.street_address,
              area: b.area,
              city: b.city,
              pincode: b.pincode,
              preferredDate: b.preferred_date,
              timeSlot: b.time_slot,
              notes: b.notes || undefined,
            },
            materials: (b.booking_items || []).map((item: any) => ({
              materialId: item.material_id,
              materialName: item.material_name,
              category: item.category as any,
              quantity: Number(item.quantity),
              unit: item.unit as any,
              ratePerUnit: Number(item.rate_per_unit),
              estimatedSubtotal: Number(item.estimated_subtotal),
              actualQuantity: item.actual_quantity != null ? Number(item.actual_quantity) : undefined,
              actualRate: item.actual_rate != null ? Number(item.actual_rate) : undefined,
              actualSubtotal: item.actual_subtotal != null ? Number(item.actual_subtotal) : undefined,
            })),
            assignedDealer: b.dealers
              ? {
                  id: b.dealers.id,
                  name: b.dealers.business_name,
                  businessName: b.dealers.business_name,
                  phone: b.dealers.phone,
                  rating: Number(b.dealers.rating),
                  vehicleType: b.dealers.vehicle_type || 'Mini Electric Van',
                  verifiedBadge: b.dealers.is_verified,
                  assignedAt: b.created_at,
                }
              : undefined,
            statusHistory: (b.booking_status_history || [])
              .map((h: any) => ({
                status: h.new_status as BookingStatus,
                timestamp: h.created_at,
                note: h.note || 'Status updated',
              }))
              .sort(
                (a: any, b: any) =>
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              ),
            photoPaths: b.photo_paths || [],
          }));

          setBookings(mapped);

          // Update currently open modal with fresh data
          const targetId = searchParams.get('id');
          if (targetId) {
            const found = mapped.find((bk) => bk.id.toLowerCase() === targetId.toLowerCase());
            if (found) setSelectedBooking(found);
          }
        }
      } catch (err) {
        console.warn('Error fetching Supabase bookings:', err);
        setBookings(getBookings());
      }
    } else {
      // Local storage fallback
      const all = getBookings();
      setBookings(all);
      const targetId = searchParams.get('id');
      if (targetId) {
        const found = all.find((bk) => bk.id.toLowerCase() === targetId.toLowerCase());
        if (found) setSelectedBooking(found);
      }
    }
    setLoading(false);
    setLastRefreshedAt(new Date());
  }, [isConfigured, user, searchParams]);

  useEffect(() => {
    fetchBookings();

    // 1. Supabase Realtime channel subscription
    let channel: any = null;
    if (isConfigured && isSupabaseConfigured() && user) {
      try {
        channel = supabase
          .channel(`customer-bookings-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'bookings',
              filter: `customer_id=eq.${user.id}`,
            },
            () => {
              fetchBookings();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'booking_status_history',
            },
            () => {
              fetchBookings();
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime channel subscription error:', err);
      }
    }

    // 2. Local storage listener
    const unsubscribeStorage = subscribeToBookingChanges(fetchBookings);

    // 3. Sensible Polling Fallback Interval (20s) to keep live tracking fresh
    const pollInterval = setInterval(() => {
      fetchBookings();
    }, 20000);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      unsubscribeStorage();
      clearInterval(pollInterval);
    };
  }, [fetchBookings, isConfigured, user]);

  // Cancel handler with customer reason
  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    setIsSubmittingCancel(true);
    const reasonText = cancelReason.trim() || 'Cancelled by customer';

    if (isConfigured && isSupabaseConfigured() && user) {
      try {
        const { error } = await supabase
          .from('bookings')
          .update({
            status: 'cancelled' as BookingStatus,
            cancellation_reason: reasonText,
          })
          .eq('id', cancellingBooking.id);

        if (error) {
          showToast('Cancellation Failed', error.message, 'error');
          setIsSubmittingCancel(false);
          return;
        }

        showToast(
          'Booking Cancelled',
          `Pickup ${cancellingBooking.id} has been cancelled in database.`,
          'info'
        );
        await fetchBookings();
        if (selectedBooking && selectedBooking.id === cancellingBooking.id) {
          setSelectedBooking({
            ...selectedBooking,
            status: 'cancelled',
            cancellationReason: reasonText,
          });
        }
      } catch (err: any) {
        showToast('Error', err.message || 'Failed to cancel', 'error');
      }
    } else {
      const updated = updateBookingStatus(cancellingBooking.id, 'cancelled', {
        cancellationReason: reasonText,
        note: `Cancelled by customer: ${reasonText}`,
      });
      if (updated) {
        showToast('Booking Cancelled', `Pickup ${cancellingBooking.id} has been cancelled.`, 'info');
        if (selectedBooking && selectedBooking.id === cancellingBooking.id) {
          setSelectedBooking(updated);
        }
      }
    }
    setIsSubmittingCancel(false);
    setCancellingBooking(null);
    setCancelReason('');
  };

  const handleOpenDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    searchParams.set('id', booking.id);
    setSearchParams(searchParams);
  };

  const handleCloseDetails = () => {
    setSelectedBooking(null);
    searchParams.delete('id');
    setSearchParams(searchParams);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isConfigured && isSupabaseConfigured() ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold backdrop-blur-md">
                <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Supabase Live Tracking Active</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-semibold backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Local Browser Sandbox • Sample Data</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => fetchBookings()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-full border border-white/10 transition-colors shadow-2xs"
              title="Refresh tracking status"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Status'}</span>
            </button>
            <span className="text-[11px] text-[#9cb1a4] hidden sm:inline">
              Auto-syncs live • Last checked: {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            My Pickup Bookings
          </h1>
          <p className="text-sm text-[#9cb1a4] mt-1">
            Realtime 7-stage doorstep pickup tracking, assigned collection partner, electronic weighing, and payout status.
          </p>
        </div>

        <Link
          to="/book"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-[#07130c] shadow-lg shadow-emerald-500/20 transition-all self-start sm:self-center active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>New Pickup Request</span>
        </Link>
      </div>

      {/* Bookings List or Empty State */}
      {bookings.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border-white/[0.08] space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/25">
            <Calendar className="w-8 h-8 stroke-[2]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">No Bookings Found</h2>
            <p className="text-sm text-[#9cb1a4] max-w-md mx-auto">
              You haven't scheduled any scrap pickups yet. Check indicative rates and book your first doorstep pickup.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/book"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-emerald-500 text-[#07130c] hover:bg-emerald-400 transition-colors active:scale-[0.98] shadow-lg shadow-emerald-500/20"
            >
              <span>Schedule a Pickup</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const statusInfo = getStatusDetails(booking.status);
            const canCancel =
              booking.status === 'requested' ||
              booking.status === 'dealer_assigned' ||
              booking.status === 'scheduled' ||
              booking.status === 'rescheduled';

            return (
              <div
                key={booking.id}
                className="glass-card rounded-2xl p-5 sm:p-6 border-white/[0.08] hover:border-emerald-500/30 shadow-xl transition-all flex flex-col gap-4"
              >
                {/* Top Row: ID, Status Badge, Payout */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-extrabold text-base text-white font-mono">
                      {booking.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ring-1 ${statusInfo.badgeClass}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                      <span>{statusInfo.label}</span>
                    </span>
                    {booking.isDemoSample && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-white/[0.06] text-emerald-200 rounded border border-white/10">
                        Sample Demo
                      </span>
                    )}
                    <span className="text-xs text-emerald-100/60">
                      Created {formatDate(booking.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs text-[#9cb1a4] font-semibold">
                      {booking.actualTotal != null ? 'Verified Payout:' : 'Est. Payout:'}
                    </span>
                    <span className="text-lg font-black text-emerald-400">
                      {formatINR(booking.actualTotal != null ? booking.actualTotal : booking.estimatedTotal)}
                    </span>
                  </div>
                </div>

                {/* Middle: Compact Stepper Timeline Bar */}
                <div className="py-1">
                  <PickupTrackerTimeline booking={booking} compact={true} />
                </div>

                {/* Bottom Row: Address, Slot, Items, Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between pt-3 border-t border-white/[0.06] gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-[#9cb1a4]">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          {formatDate(booking.scheduledDate || booking.address.preferredDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{booking.scheduledTimeSlot || booking.address.timeSlot}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{booking.address.area}, {booking.address.city}</span>
                      </div>
                    </div>

                    {/* Materials Pill Summary */}
                    <div className="flex flex-wrap gap-1.5">
                      {booking.materials.map((m) => (
                        <span
                          key={m.materialId}
                          className="px-2.5 py-0.5 text-xs rounded-lg bg-white/[0.04] border border-white/10 text-white/90 font-medium"
                        >
                          {m.materialName} ({m.actualQuantity != null ? `${m.actualQuantity} ${m.unit} weighed` : `${m.quantity} ${m.unit}`})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancellingBooking(booking);
                          setCancelReason('');
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenDetails(booking)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-emerald-500 text-white hover:text-[#07130c] border border-white/15 hover:border-emerald-400 shadow-sm transition-all active:scale-[0.98]"
                    >
                      <span>Track Pickup</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: LIVE PICKUP TRACKER TIMELINE & DETAILS */}
      {selectedBooking && (
        <Modal
          isOpen={!!selectedBooking}
          onClose={handleCloseDetails}
          title={`Order Tracking: ${selectedBooking.id}`}
          subtitle={`Placed on ${formatDateTime(selectedBooking.createdAt)}`}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            {/* Top Bar with Cancel option if eligible */}
            {(selectedBooking.status === 'requested' ||
              selectedBooking.status === 'dealer_assigned' ||
              selectedBooking.status === 'scheduled' ||
              selectedBooking.status === 'rescheduled') && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
                <span className="text-[#9cb1a4]">
                  Need to change your pickup plan before collection partner arrives?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCancellingBooking(selectedBooking);
                    setCancelReason('');
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors shrink-0 ml-3"
                >
                  Cancel Pickup
                </button>
              </div>
            )}

            {/* Embedded 7-Step Pickup Tracker Timeline */}
            <PickupTrackerTimeline booking={selectedBooking} compact={false} />

            {/* Materials Breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                Itemized Manifest & Rates
              </span>
              <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/[0.06] text-xs">
                {selectedBooking.materials.map((m) => (
                  <div key={m.materialId} className="p-3 flex items-center justify-between bg-white/[0.02]">
                    <div>
                      <span className="font-bold text-sm text-white">{m.materialName}</span>
                      <span className="text-[#9cb1a4] block">
                        Estimated: {m.quantity} {m.unit} @ {formatINR(m.ratePerUnit)}/{m.unit}
                      </span>
                    </div>
                    <div className="text-right">
                      {m.actualQuantity != null ? (
                        <>
                          <span className="font-black text-sm text-emerald-400 block">
                            {formatINR(m.actualSubtotal || m.estimatedSubtotal)}
                          </span>
                          <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            Weighed: {m.actualQuantity} {m.unit}
                          </span>
                        </>
                      ) : (
                        <span className="font-black text-sm text-white">
                          {formatINR(m.estimatedSubtotal)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                    {selectedBooking.actualTotal != null ? 'Verified Settlement Total' : 'Estimated Payout'}
                  </span>
                  <span className="text-[11px] text-[#9cb1a4]">
                    {selectedBooking.actualTotal != null
                      ? 'Confirmed via digital scale weighing'
                      : 'Subject to digital scale verification on doorstep'}
                  </span>
                </div>
                <span className="text-2xl font-black text-emerald-400">
                  {formatINR(selectedBooking.actualTotal != null ? selectedBooking.actualTotal : selectedBooking.estimatedTotal)}
                </span>
              </div>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleCloseDetails}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors"
              >
                Close Tracking Sheet
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* CUSTOMER CANCELLATION MODAL WITH REASON */}
      {cancellingBooking && (
        <Modal
          isOpen={!!cancellingBooking}
          onClose={() => {
            if (!isSubmittingCancel) {
              setCancellingBooking(null);
              setCancelReason('');
            }
          }}
          title={`Cancel Pickup: ${cancellingBooking.id}?`}
          subtitle="Please let us know the reason so we can release your collection partner"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <span>
                Cancelling this pickup request will notify your assigned dealer partner and immediately cancel the scheduled slot.
              </span>
            </div>

            <div className="space-y-2">
              <label htmlFor="cancel-reason-input" className="font-bold text-white block">
                Reason for Cancellation <span className="text-rose-400">*</span>
              </label>

              {/* Quick Reason Chips */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {[
                  'Change of schedule',
                  'Scrap already disposed',
                  'Preferred timing not available',
                  'Booked by mistake',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCancelReason(preset)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                      cancelReason === preset
                        ? 'bg-emerald-500 text-[#07130c] font-bold border-emerald-400'
                        : 'bg-white/[0.04] text-[#9cb1a4] border-white/10 hover:border-emerald-500/40 hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                id="cancel-reason-input"
                rows={3}
                placeholder="E.g. Out of town, or scrap collected by apartment society drive..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={() => {
                  setCancellingBooking(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#9cb1a4] hover:bg-white/10 transition-colors"
              >
                Keep Pickup
              </button>

              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-colors flex items-center gap-1.5"
              >
                {isSubmittingCancel ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Confirm Cancellation</span>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
