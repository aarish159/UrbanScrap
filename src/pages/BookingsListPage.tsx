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
  Scale,
  Phone,
  Database,
  RefreshCw,
} from 'lucide-react';
import type { Booking, BookingStatus } from '../types';
import {
  getBookings,
  updateBookingStatus,
  subscribeToBookingChanges,
} from '../utils/storage';
import { formatINR, formatDate, formatDateTime, getStatusDetails } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { useScrollAnimation } from '../utils/useScrollAnimation';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const BookingsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { user, isConfigured } = useAuth();
  useScrollAnimation();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);

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
            notes,
            status,
            estimated_total,
            created_at,
            booking_items (
              id,
              material_id,
              material_name,
              category,
              quantity,
              unit,
              rate_per_unit,
              estimated_subtotal
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
          }));

          setBookings(mapped);

          // Auto open if query param ?id=...
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
  }, [isConfigured, user, searchParams]);

  useEffect(() => {
    fetchBookings();
    if (!isConfigured || !isSupabaseConfigured()) {
      const unsubscribe = subscribeToBookingChanges(fetchBookings);
      return () => unsubscribe();
    }
  }, [fetchBookings, isConfigured]);

  // Cancel handler
  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;

    if (isConfigured && isSupabaseConfigured() && user) {
      try {
        const { error } = await supabase
          .from('bookings')
          .update({ status: 'cancelled' as BookingStatus })
          .eq('id', cancellingBooking.id);

        if (error) {
          showToast('Cancellation Failed', error.message, 'error');
          setCancellingBooking(null);
          return;
        }

        showToast(
          'Booking Cancelled',
          `Pickup ${cancellingBooking.id} has been marked as cancelled in Supabase.`,
          'info'
        );
        await fetchBookings();
        if (selectedBooking && selectedBooking.id === cancellingBooking.id) {
          setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
        }
      } catch (err: any) {
        showToast('Error', err.message || 'Failed to cancel', 'error');
      }
    } else {
      const updated = updateBookingStatus(
        cancellingBooking.id,
        'cancelled',
        'Cancelled by customer from My Bookings'
      );
      if (updated) {
        showToast('Booking Cancelled', `Pickup ${cancellingBooking.id} has been cancelled.`, 'info');
        if (selectedBooking && selectedBooking.id === cancellingBooking.id) {
          setSelectedBooking(updated);
        }
      }
    }
    setCancellingBooking(null);
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isConfigured && isSupabaseConfigured() ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Supabase Cloud Connected • Secure RLS Active</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Local Browser Sandbox • Demo Mode</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => fetchBookings()}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:text-emerald-950 bg-emerald-50/60 rounded-full border border-emerald-200/80 transition-colors"
              title="Refresh bookings"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          <h1 className="text-3xl font-extrabold text-[#123b26] tracking-tight">
            My Pickup Bookings
          </h1>
          <p className="text-sm text-[#525955] mt-1">
            Track your doorstep scrap requests, dealer assignments, scheduled time slots, and inspection status.
          </p>
        </div>

        <Link
          to="/book"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md shadow-[#16a34a]/20 transition-all self-start sm:self-center active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>New Pickup Request</span>
        </Link>
      </div>

      {/* Bookings List or Empty State */}
      {bookings.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#e6e8e5] space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#eaf8ef] text-[#16a34a] mx-auto flex items-center justify-center">
            <Calendar className="w-8 h-8 stroke-[2]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[#123b26]">No Bookings Found</h2>
            <p className="text-sm text-[#717a75] max-w-md mx-auto">
              You haven't scheduled any scrap pickups yet. Check indicative rates and book your first doorstep pickup.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/book"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-[#123b26] text-white hover:bg-[#1a5336] transition-colors active:scale-[0.98]"
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
              booking.status === 'requested' || booking.status === 'dealer_assigned';

            return (
              <div
                key={booking.id}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-[#e6e8e5] shadow-xs hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                {/* Left col: ID, Status, Items */}
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-extrabold text-base text-[#123b26] font-mono">
                      {booking.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ring-1 ${statusInfo.badgeClass}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                      <span>{statusInfo.label}</span>
                    </span>
                    {booking.isDemoSample && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-700 rounded border border-gray-200">
                        Seed Demo
                      </span>
                    )}
                    <span className="text-xs text-[#717a75]">
                      Created {formatDate(booking.createdAt)}
                    </span>
                  </div>

                  {/* Scheduled Slot & Address summary */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-[#525955]">
                    <div className="flex items-center gap-1.5 font-bold text-[#191c1a]">
                      <Calendar className="w-4 h-4 text-[#16a34a] shrink-0" />
                      <span>{formatDate(booking.address.preferredDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-4 h-4 text-[#16a34a] shrink-0" />
                      <span>{booking.address.timeSlot}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      <MapPin className="w-4 h-4 text-[#16a34a] shrink-0" />
                      <span>{booking.address.area}, {booking.address.city}</span>
                    </div>
                  </div>

                  {/* Next Step / Status explanation */}
                  <p className="text-xs text-[#717a75] italic">
                    Next step: {statusInfo.description}
                  </p>

                  {/* Materials Pill Summary */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {booking.materials.map((m) => (
                      <span
                        key={m.materialId}
                        className="px-2.5 py-1 text-xs rounded-lg bg-[#f8faf9] border border-[#e2e4e1] text-[#282c2a] font-medium"
                      >
                        {m.materialName} ({m.quantity} {m.unit})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right col: Estimated Value & Actions */}
                <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 pt-4 lg:pt-0 border-[#f1f3f1] gap-4 shrink-0">
                  <div className="lg:text-right">
                    <span className="text-[11px] text-[#717a75] uppercase font-bold tracking-wider block">
                      Estimated Payout
                    </span>
                    <span className="text-xl font-black text-[#123b26]">
                      {formatINR(booking.estimatedTotal)}
                    </span>
                    <span className="text-[10px] text-[#9aa19d] block">Indicative estimate</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => setCancellingBooking(booking)}
                        className="px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenDetails(booking)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#123b26] hover:bg-[#16a34a] text-white shadow-2xs transition-all active:scale-[0.98]"
                    >
                      <span>View Details</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: BOOKING DETAILS */}
      {selectedBooking && (
        <Modal
          isOpen={!!selectedBooking}
          onClose={handleCloseDetails}
          title={`Booking Details: ${selectedBooking.id}`}
          subtitle={`Created on ${formatDateTime(selectedBooking.createdAt)}`}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            {/* Status Banner */}
            {(() => {
              const statusDetails = getStatusDetails(selectedBooking.status);
              return (
                <div
                  className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${statusDetails.badgeClass}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`w-3 h-3 rounded-full mt-1 shrink-0 ${statusDetails.dotClass}`}
                    />
                    <div>
                      <h3 className="font-bold text-sm">Status: {statusDetails.label}</h3>
                      <p className="text-xs mt-0.5 opacity-90">{statusDetails.description}</p>
                    </div>
                  </div>

                  {(selectedBooking.status === 'requested' ||
                    selectedBooking.status === 'dealer_assigned') && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancellingBooking(selectedBooking);
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-bold text-rose-700 bg-white/80 hover:bg-white border border-rose-300 transition-colors"
                    >
                      Cancel Pickup
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Assigned Partner Card */}
            {selectedBooking.assignedDealer && (
              <div className="p-4 rounded-xl bg-[#f8faf9] border border-[#e2e4e1] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#717a75]">
                    Assigned Collection Partner
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                    Verified Digital Partner
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div>
                    <h3 className="font-bold text-base text-[#123b26]">
                      {selectedBooking.assignedDealer.name}
                    </h3>
                    <p className="text-xs text-[#525955]">
                      {selectedBooking.assignedDealer.businessName} • Rating: {selectedBooking.assignedDealer.rating} ★
                    </p>
                    <p className="text-xs text-[#717a75] mt-0.5">
                      Vehicle: {selectedBooking.assignedDealer.vehicleType}
                    </p>
                  </div>

                  <div className="text-xs text-[#123b26] font-semibold bg-white px-3 py-2 rounded-lg border border-[#e2e4e1] self-start sm:self-center flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#16a34a]" />
                    <span>{selectedBooking.assignedDealer.phone}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Materials Breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#717a75] block">
                Scrap Items Breakdown
              </span>
              <div className="border border-[#e6e8e5] rounded-xl overflow-hidden divide-y divide-[#f1f3f1] text-xs">
                {selectedBooking.materials.map((m) => (
                  <div key={m.materialId} className="p-3 flex items-center justify-between bg-white">
                    <div>
                      <span className="font-bold text-sm text-[#123b26]">{m.materialName}</span>
                      <span className="text-[#717a75] block">
                        Estimated: {m.quantity} {m.unit} @ {formatINR(m.ratePerUnit)}/{m.unit}
                      </span>
                    </div>
                    <span className="font-black text-sm text-[#123b26]">
                      {formatINR(m.estimatedSubtotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-[#eaf8ef] border border-[#bbf7d0] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#16a34a] uppercase tracking-wider block">
                    Indicative Payout Estimate
                  </span>
                  <span className="text-[11px] text-[#525955]">
                    Subject to digital scale verification
                  </span>
                </div>
                <span className="text-xl font-black text-[#123b26]">
                  {formatINR(selectedBooking.estimatedTotal)}
                </span>
              </div>
            </div>

            {/* Address & Slot Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#3f4541]">
              <div className="p-3.5 rounded-xl bg-[#fbfbf9] border border-[#e6e8e5] space-y-1">
                <span className="font-bold text-[#123b26] block mb-1">Pickup Address</span>
                <p className="font-bold text-sm text-[#191c1a]">
                  {selectedBooking.address.fullName}
                </p>
                <p>{selectedBooking.address.streetAddress}</p>
                <p>{selectedBooking.address.area}, {selectedBooking.address.city} - {selectedBooking.address.pincode}</p>
                <p className="pt-0.5">Phone: +91 {selectedBooking.address.phoneNumber}</p>
                {selectedBooking.address.email && <p>Email: {selectedBooking.address.email}</p>}
                {selectedBooking.address.notes && (
                  <p className="italic text-[#717a75] pt-1">
                    Special notes: "{selectedBooking.address.notes}"
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-[#fbfbf9] border border-[#e6e8e5] space-y-2">
                <span className="font-bold text-[#123b26] block mb-1">Slot & Verification</span>
                <p className="flex items-center gap-1.5 font-bold text-sm text-[#123b26]">
                  <Calendar className="w-4 h-4 text-[#16a34a]" />
                  <span>{formatDate(selectedBooking.address.preferredDate)}</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#16a34a]" />
                  <span>{selectedBooking.address.timeSlot}</span>
                </p>
                <div className="pt-2 border-t border-[#e8ebe8] text-[11px] text-[#717a75] flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-[#16a34a]" />
                  <span>Electronic weighing scale verified</span>
                </div>
              </div>
            </div>

            {/* Status History Timeline */}
            {selectedBooking.statusHistory && selectedBooking.statusHistory.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#717a75] block">
                  Activity Timeline
                </span>
                <div className="space-y-2 text-xs border-l-2 border-[#bbf7d0] pl-3 ml-1.5">
                  {selectedBooking.statusHistory.map((h, i) => (
                    <div key={i} className="relative pb-2">
                      <span className="w-2 h-2 rounded-full bg-[#16a34a] absolute -left-[17px] top-1" />
                      <div>
                        <span className="font-bold text-[#191c1a] capitalize">
                          {h.status.replace('_', ' ')}
                        </span>
                        <span className="text-[#9aa19d] ml-2 text-[11px]">
                          {formatDateTime(h.timestamp)}
                        </span>
                        <p className="text-[#525955] mt-0.5">{h.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prototype notice */}
            <div className="text-[11px] text-[#717a75] italic text-center pt-2">
              Note: Simulated demo data stored in localStorage. You can update this status from the Dealer Dashboard.
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRM CANCELLATION DIALOG */}
      {cancellingBooking && (
        <ConfirmDialog
          isOpen={!!cancellingBooking}
          onClose={() => setCancellingBooking(null)}
          onConfirm={handleConfirmCancel}
          title={`Cancel Pickup ${cancellingBooking.id}?`}
          message="Are you sure you want to cancel this scheduled scrap pickup? Your assigned collection partner will be notified and this booking will be marked as Cancelled."
          confirmLabel="Yes, Cancel Pickup"
          cancelLabel="Keep Pickup"
          isDestructive={true}
        />
      )}
    </div>
  );
};
