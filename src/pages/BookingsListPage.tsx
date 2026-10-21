import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Plus,
} from 'lucide-react';
import type { Booking } from '../types';
import {
  getBookings,
  updateBookingStatus,
  subscribeToBookingChanges,
} from '../utils/storage';
import { formatINR, formatDate, formatDateTime, getStatusDetails } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

export const BookingsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);

  // Load and subscribe to storage changes
  useEffect(() => {
    const refresh = () => {
      const all = getBookings();
      setBookings(all);

      // Auto-open if query param ?id=... is present
      const targetId = searchParams.get('id');
      if (targetId) {
        const found = all.find((b) => b.id.toLowerCase() === targetId.toLowerCase());
        if (found) {
          setSelectedBooking(found);
        }
      }
    };

    refresh();
    const unsubscribe = subscribeToBookingChanges(refresh);
    return () => unsubscribe();
  }, [searchParams]);

  // Cancel handler
  const handleConfirmCancel = () => {
    if (!cancellingBooking) return;
    const updated = updateBookingStatus(
      cancellingBooking.id,
      'cancelled',
      'Cancelled by customer from My Bookings'
    );
    if (updated) {
      showToast('Booking Cancelled', `Pickup ${cancellingBooking.id} has been cancelled.`, 'info');
      // Update selected booking if currently viewing
      if (selectedBooking && selectedBooking.id === cancellingBooking.id) {
        setSelectedBooking(updated);
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Local Browser State • Persistent Sessions</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#143e29] tracking-tight">
            My Pickup Bookings
          </h1>
          <p className="text-sm text-[#555c58] mt-1">
            Track your doorstep scrap requests, dealer assignments, and inspection status.
          </p>
        </div>

        <Link
          to="/book"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md shadow-[#16a34a]/20 transition-all self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>New Pickup Request</span>
        </Link>
      </div>

      {/* Bookings List or Empty State */}
      {bookings.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#e8e8e3] space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#eef7f1] text-[#16a34a] mx-auto flex items-center justify-center">
            <Calendar className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-[#143e29]">No Bookings Found</h3>
            <p className="text-sm text-[#717a75] max-w-md mx-auto">
              You haven't scheduled any scrap pickups yet. Check indicative prices and book your first doorstep pickup.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/book"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-[#143e29] text-white hover:bg-[#1a5336]"
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
                className="bg-white rounded-2xl p-5 sm:p-6 border border-[#e8e8e3] shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                {/* Left col: ID, Status, Items */}
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-extrabold text-base text-[#143e29] font-mono">
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
                      Booked {formatDate(booking.createdAt)}
                    </span>
                  </div>

                  {/* Scheduled Slot & Address summary */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-[#555c58]">
                    <div className="flex items-center gap-1.5 font-semibold text-[#191c1a]">
                      <Calendar className="w-4 h-4 text-[#16a34a]" />
                      <span>{formatDate(booking.address.preferredDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#16a34a]" />
                      <span>{booking.address.timeSlot}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#16a34a]" />
                      <span>{booking.address.area}, {booking.address.city}</span>
                    </div>
                  </div>

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
                    <span className="text-[11px] text-[#717a75] uppercase tracking-wider block">
                      Estimated Value
                    </span>
                    <span className="text-xl font-black text-[#143e29]">
                      {formatINR(booking.estimatedTotal)}
                    </span>
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
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#143e29] hover:bg-[#16a34a] text-white shadow-sm transition-all"
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
                      <h4 className="font-bold text-sm">Status: {statusDetails.label}</h4>
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
                      className="px-3 py-1 rounded-lg text-xs font-bold text-rose-700 bg-white/80 hover:bg-white border border-rose-300"
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
                    Assigned Dealer Partner
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                    Verified Digital Partner
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div>
                    <h4 className="font-bold text-base text-[#143e29]">
                      {selectedBooking.assignedDealer.name}
                    </h4>
                    <p className="text-xs text-[#555c58]">
                      {selectedBooking.assignedDealer.businessName} • Rating: {selectedBooking.assignedDealer.rating} ★
                    </p>
                    <p className="text-xs text-[#717a75] mt-0.5">
                      Vehicle: {selectedBooking.assignedDealer.vehicleType}
                    </p>
                  </div>

                  <div className="text-xs text-[#143e29] font-semibold bg-white px-3 py-2 rounded-lg border border-[#e2e4e1] self-start sm:self-center">
                    Phone: {selectedBooking.assignedDealer.phone}
                  </div>
                </div>
              </div>
            )}

            {/* Materials Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#717a75]">
                Scrap Items Breakdown
              </h4>
              <div className="border border-[#e8e8e3] rounded-xl overflow-hidden divide-y divide-[#f1f3f1] text-xs">
                {selectedBooking.materials.map((m) => (
                  <div key={m.materialId} className="p-3 flex items-center justify-between bg-white">
                    <div>
                      <span className="font-bold text-sm text-[#143e29]">{m.materialName}</span>
                      <span className="text-[#717a75] block">
                        Estimated quantity: {m.quantity} {m.unit} @ {formatINR(m.ratePerUnit)}/{m.unit}
                      </span>
                    </div>
                    <span className="font-extrabold text-sm text-[#143e29]">
                      {formatINR(m.estimatedSubtotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-between">
                <span className="text-xs font-bold text-[#16a34a] uppercase tracking-wider">
                  Indicative Payout Estimate
                </span>
                <span className="text-lg font-black text-[#143e29]">
                  {formatINR(selectedBooking.estimatedTotal)}
                </span>
              </div>
            </div>

            {/* Address & Slot Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#3f4441]">
              <div className="p-3.5 rounded-xl bg-[#fbfbf9] border border-[#e8e8e3] space-y-1">
                <span className="font-bold text-[#143e29] block mb-1">Pickup Address</span>
                <p className="font-semibold text-sm text-[#143e29]">
                  {selectedBooking.address.fullName}
                </p>
                <p>{selectedBooking.address.streetAddress}</p>
                <p>{selectedBooking.address.area}, {selectedBooking.address.city} - {selectedBooking.address.pincode}</p>
                <p>Phone: +91 {selectedBooking.address.phoneNumber}</p>
                {selectedBooking.address.email && <p>Email: {selectedBooking.address.email}</p>}
                {selectedBooking.address.notes && (
                  <p className="italic text-[#717a75] pt-1">
                    Special notes: "{selectedBooking.address.notes}"
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-[#fbfbf9] border border-[#e8e8e3] space-y-2">
                <span className="font-bold text-[#143e29] block mb-1">Slot & Timeline</span>
                <p className="flex items-center gap-1.5 font-bold text-sm text-[#143e29]">
                  <Calendar className="w-4 h-4 text-[#16a34a]" />
                  <span>{formatDate(selectedBooking.address.preferredDate)}</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#16a34a]" />
                  <span>{selectedBooking.address.timeSlot}</span>
                </p>
                <div className="pt-2 border-t border-[#e8e8e3] text-[11px] text-[#717a75]">
                  Status History ({selectedBooking.statusHistory?.length || 1} events logged)
                </div>
              </div>
            </div>

            {/* Status History Timeline */}
            {selectedBooking.statusHistory && selectedBooking.statusHistory.length > 0 && (
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#717a75]">
                  Activity Log
                </h4>
                <div className="space-y-2 text-xs">
                  {selectedBooking.statusHistory.map((h, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[#555c58]">
                      <span className="w-2 h-2 rounded-full bg-[#16a34a] mt-1.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-[#191c1a] capitalize">
                          {h.status.replace('_', ' ')}
                        </span>
                        <span className="text-[#9aa19d] ml-2">
                          {formatDateTime(h.timestamp)}
                        </span>
                        <p className="text-[#717a75]">{h.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prototype notice */}
            <div className="text-[11px] text-[#717a75] italic text-center pt-2">
              Note: This is simulated local demo data. You can test status changes from the Dealer Dashboard.
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
          message="Are you sure you want to cancel this scheduled scrap pickup? Your assigned dealer will be informed and the booking status will be updated to Cancelled."
          confirmLabel="Yes, Cancel Pickup"
          cancelLabel="Keep Pickup"
          isDestructive={true}
        />
      )}
    </div>
  );
};
