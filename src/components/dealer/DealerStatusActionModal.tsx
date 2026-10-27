import React, { useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';


import type { Booking, BookingStatus, SelectedMaterialItem } from '../../types';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { formatINR, formatDate, isValidUuid } from '../../utils/formatters';
import { TIME_SLOTS } from '../../data/mockData';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { updateBookingStatus } from '../../utils/storage';

export type DealerActionType =
  | 'claim'
  | 'schedule'
  | 'on_the_way'
  | 'weigh'
  | 'payment'
  | 'complete'
  | 'reschedule'
  | 'cancel';

interface DealerStatusActionModalProps {
  booking: Booking;
  actionType: DealerActionType;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  dealerId?: string;
  isConfigured: boolean;
  user: any;
}

export const DealerStatusActionModal: React.FC<DealerStatusActionModalProps> = ({
  booking,
  actionType,
  isOpen,
  onClose,
  onSuccess,
  dealerId,
  isConfigured,
  user,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  // Scheduling state
  const [scheduledDate, setScheduledDate] = useState(
    booking.scheduledDate || booking.address.preferredDate || new Date().toISOString().split('T')[0]
  );
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState(
    booking.scheduledTimeSlot || booking.address.timeSlot || TIME_SLOTS[0]
  );

  // On the way note
  const [driverNote, setDriverNote] = useState(
    booking.driverNote || 'Driver dispatched in EV Loader, ETA ~20 mins.'
  );

  // Weighing items state
  const [weighedItems, setWeighedItems] = useState<SelectedMaterialItem[]>(
    booking.materials.map((m) => ({
      ...m,
      actualQuantity: m.actualQuantity != null ? m.actualQuantity : m.quantity,
      actualRate: m.actualRate != null ? m.actualRate : m.ratePerUnit,
      actualSubtotal:
        m.actualSubtotal != null
          ? m.actualSubtotal
          : (m.actualQuantity != null ? m.actualQuantity : m.quantity) *
            (m.actualRate != null ? m.actualRate : m.ratePerUnit),
    }))
  );

  // Payment state
  const computedTotal = weighedItems.reduce(
    (sum, item) => sum + (item.actualSubtotal != null ? item.actualSubtotal : item.estimatedSubtotal),
    0
  );
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank_transfer'>('upi');
  const [paymentAmount, setPaymentAmount] = useState<number>(
    booking.actualTotal != null ? booking.actualTotal : computedTotal || booking.estimatedTotal
  );
  const [paymentReference, setPaymentReference] = useState<string>('');

  // Reschedule state
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [rescheduledDate, setRescheduledDate] = useState<string>(
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [rescheduledTimeSlot, setRescheduledTimeSlot] = useState<string>(TIME_SLOTS[0]);

  // Cancel state
  const [cancellationReason, setCancellationReason] = useState<string>('');

  // Quantity/rate change handler for weighing step
  const handleItemWeightChange = (index: number, quantity: number, rate: number) => {
    setWeighedItems((prev) => {
      const copy = [...prev];
      const validQty = Math.max(0, quantity || 0);
      const validRate = Math.max(0, rate || 0);
      copy[index] = {
        ...copy[index],
        actualQuantity: validQty,
        actualRate: validRate,
        actualSubtotal: Math.round(validQty * validRate),
      };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let targetStatus: BookingStatus;
      let bookingUpdatePayload: any = {};
      let itemsToUpdate: any[] = [];
      let auditNote = '';

      const isClaimAction = actionType === 'claim';

      // Resolve effective dealer database UUID
      let effectiveDealerId = dealerId;
      if (isConfigured && isSupabaseConfigured() && user && (!effectiveDealerId || !isValidUuid(effectiveDealerId))) {
        const { data: dRow } = await supabase
          .from('dealers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (dRow?.id) {
          effectiveDealerId = dRow.id;
        } else {
          // Auto-provision demo partner record so session has a genuine UUID
          try {
            const { data: newDealer } = await (supabase.from('dealers') as any)
              .insert({
                user_id: user.id,
                business_name: 'UrbanScrap Demo Partner',
                phone: '9876543210',
                service_area: 'Bengaluru Central',
                vehicle_type: 'Mini Electric Van',
                rating: 4.90,
                is_verified: false,
                is_demo: true,
              })
              .select('id')
              .maybeSingle();
            if (newDealer?.id) {
              effectiveDealerId = newDealer.id;
            }
          } catch (createErr) {
            console.warn('Could not auto-provision dealer record in frontend:', createErr);
          }
        }
      }

      const hasValidDealerUuid = isValidUuid(effectiveDealerId);

      switch (actionType) {
        case 'claim':
          targetStatus = 'dealer_assigned';
          bookingUpdatePayload = {
            status: targetStatus,
            ...(hasValidDealerUuid ? { assigned_dealer_id: effectiveDealerId } : {}),
          };
          auditNote = hasValidDealerUuid
            ? 'Pickup claimed and assigned to dealer partner.'
            : 'Pickup claimed and assigned to demo partner (Sandbox).';
          break;


        case 'schedule':
          if (!scheduledDate || !scheduledTimeSlot) {
            showToast('Missing details', 'Please choose confirmed date and time slot.', 'error');
            setLoading(false);
            return;
          }
          targetStatus = 'scheduled';
          bookingUpdatePayload = {
            status: targetStatus,
            scheduled_date: scheduledDate,
            scheduled_time_slot: scheduledTimeSlot,
            scheduled_pickup_at: new Date(`${scheduledDate}T10:00:00Z`).toISOString(),
          };
          auditNote = `Pickup scheduled for ${formatDate(scheduledDate)} (${scheduledTimeSlot}).`;
          break;

        case 'on_the_way':
          targetStatus = 'on_the_way';
          bookingUpdatePayload = {
            status: targetStatus,
            driver_note: driverNote.trim() || null,
          };
          auditNote = driverNote.trim()
            ? `Dealer is on the way. Note: ${driverNote.trim()}`
            : 'Dealer partner is on the way to the pickup address.';
          break;

        case 'weigh': {
          const totalWeighed = weighedItems.reduce(
            (sum, item) => sum + (item.actualSubtotal || 0),
            0
          );
          if (totalWeighed <= 0) {
            showToast('Invalid weight', 'Actual weighed volume total must be greater than zero.', 'error');
            setLoading(false);
            return;
          }
          targetStatus = 'collected_weighed';
          bookingUpdatePayload = {
            status: targetStatus,
            actual_total: totalWeighed,
          };
          itemsToUpdate = weighedItems;
          auditNote = `Scrap collected and weighed on digital scale. Verified Total: ₹${totalWeighed}.`;
          break;
        }

        case 'payment':
          if (!paymentAmount || paymentAmount <= 0) {
            showToast('Invalid payment', 'Please enter a valid payout amount.', 'error');
            setLoading(false);
            return;
          }
          targetStatus = 'payment_completed';
          bookingUpdatePayload = {
            status: targetStatus,
            payment_method: paymentMethod,
            payment_amount: paymentAmount,
            payment_reference: paymentReference.trim() || null,
          };
          auditNote = `Payment of ₹${paymentAmount} completed via ${paymentMethod.toUpperCase()}${paymentReference ? ` (Ref: ${paymentReference.trim()})` : ''}.`;
          break;

        case 'complete':
          targetStatus = 'completed';
          bookingUpdatePayload = {
            status: targetStatus,
          };
          auditNote = 'Doorstep pickup completed and scrap received for recycling.';
          break;

        case 'reschedule':
          if (!rescheduleReason.trim() || rescheduleReason.trim().length < 3) {
            showToast('Reason required', 'Please provide a reason for rescheduling (at least 3 characters).', 'error');
            setLoading(false);
            return;
          }
          targetStatus = 'rescheduled';
          bookingUpdatePayload = {
            status: targetStatus,
            reschedule_reason: rescheduleReason.trim(),
            rescheduled_date: rescheduledDate,
            rescheduled_time_slot: rescheduledTimeSlot,
          };
          auditNote = `Pickup rescheduled: ${rescheduleReason.trim()} (Proposed: ${formatDate(rescheduledDate)} ${rescheduledTimeSlot}).`;
          break;

        case 'cancel':
          if (!cancellationReason.trim() || cancellationReason.trim().length < 3) {
            showToast('Reason required', 'Please provide a reason for cancellation.', 'error');
            setLoading(false);
            return;
          }
          targetStatus = 'cancelled';
          bookingUpdatePayload = {
            status: targetStatus,
            cancellation_reason: cancellationReason.trim(),
          };
          auditNote = `Pickup cancelled by partner: ${cancellationReason.trim()}`;
          break;

        default:
          setLoading(false);
          return;
      }

      // Execute update in Supabase if configured & user logged in (and not claiming with a non-UUID demo dealer)
      const shouldUpdateSupabase = isConfigured && isSupabaseConfigured() && user && (!isClaimAction || hasValidDealerUuid);

      if (shouldUpdateSupabase) {
        // If weighing, update item line records first
        if (actionType === 'weigh' && itemsToUpdate.length > 0) {
          for (const item of itemsToUpdate) {
            const { error: itemErr } = await (supabase.from('booking_items') as any)
              .update({
                actual_quantity: item.actualQuantity,
                actual_rate: item.actualRate,
                actual_subtotal: item.actualSubtotal,
              })
              .eq('booking_id', booking.id)
              .eq('material_id', item.materialId);

            if (itemErr) {
              console.warn('Could not update booking_items actuals directly:', itemErr.message);
            }
          }
        }

        if (isClaimAction) {
          // Attempt atomic claim RPC first if available
          let claimedSuccessfully = false;
          try {
            const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc('claim_pickup_lead', {
              p_booking_id: booking.id,
            });

            if (!rpcErr && rpcRes) {
              const res = rpcRes as any;

              if (res.already_assigned) {
                showToast(
                  'Already Claimed',
                  res.message || 'This pickup request is already claimed and assigned to your dealership.',
                  'info'
                );
                setLoading(false);
                onSuccess();
                onClose();
                return;
              }

              if (res.success === false) {
                if (res.error === 'SESSION_EXPIRED') {
                  showToast(
                    'Session Expired',
                    res.message || 'Your session has expired. Please sign in again.',
                    'error'
                  );
                } else if (res.error === 'LEAD_ALREADY_CLAIMED') {
                  showToast(
                    'Lead Already Claimed',
                    res.message || 'This pickup request has already been claimed by another partner or is no longer available.',
                    'error'
                  );
                } else if (res.error === 'PERMISSION_DENIED') {
                  showToast(
                    'Permission Denied',
                    res.message || 'Only authenticated dealer partners can accept pickup leads.',
                    'error'
                  );
                } else if (res.error === 'DEALER_PROFILE_MISSING') {
                  showToast(
                    'Dealer Profile Missing',
                    res.message || 'Dealer profile not found for this session. Please reload or apply migration 20261027000005.',
                    'error'
                  );
                } else if (res.error === 'NOT_FOUND') {
                  showToast(
                    'Request Not Found',
                    res.message || 'Pickup request not found in database.',
                    'error'
                  );
                } else {
                  showToast(
                    'Claim Not Completed',
                    res.message || 'Could not claim this pickup lead.',
                    'error'
                  );
                }
                setLoading(false);
                onSuccess();
                onClose();
                return;
              }
              claimedSuccessfully = true;
            } else if (rpcErr) {
              console.warn('claim_pickup_lead RPC notice:', rpcErr);
              if (rpcErr.code === '42501') {
                showToast(
                  'Permission Denied',
                  'Database policy denied claim. Please verify permissions or apply migration 20261027000005.',
                  'error'
                );
                setLoading(false);
                return;
              }

              // Fallback to direct atomic update if RPC function is not yet installed in Supabase schema cache
              if (rpcErr.code === 'PGRST202') {
                if (!hasValidDealerUuid) {
                  showToast(
                    'Missing Dealer Identity',
                    'Unable to resolve a valid dealer database UUID for your account. Please re-login as Demo Partner.',
                    'error'
                  );
                  setLoading(false);
                  return;
                }

                // Atomic conditional update: only update if currently requested and unassigned
                const { data: updatedRows, error: claimErr } = await (supabase.from('bookings') as any)
                  .update(bookingUpdatePayload)
                  .eq('id', booking.id)
                  .eq('status', 'requested')
                  .is('assigned_dealer_id', null)
                  .select('id, status, assigned_dealer_id');

                if (claimErr) {
                  showToast('Claim Failed', claimErr.message, 'error');
                  setLoading(false);
                  return;
                }

                if (!updatedRows || updatedRows.length === 0) {
                  const { data: checkRow } = await (supabase.from('bookings') as any)
                    .select('id, status, assigned_dealer_id')
                    .eq('id', booking.id)
                    .maybeSingle();

                  if (checkRow && (checkRow.assigned_dealer_id !== null || checkRow.status !== 'requested')) {
                    showToast(
                      'Lead Already Claimed',
                      `This pickup request was claimed by another partner (Status: ${checkRow.status}).`,
                      'error'
                    );
                  } else {
                    showToast(
                      'Database Migration Required',
                      'Atomic claim RPC is missing and direct update was blocked by RLS. Please execute migration 20261027000005 in your Supabase SQL Editor.',
                      'error'
                    );
                  }
                  setLoading(false);
                  onSuccess();
                  onClose();
                  return;
                }

                claimedSuccessfully = true;
              } else {
                showToast('Database Error', rpcErr.message || 'An error occurred while claiming lead.', 'error');
                setLoading(false);
                return;
              }
            }
          } catch (e: any) {
            console.warn('RPC invocation exception:', e);
            showToast('Connection Error', e?.message || 'Unable to connect to database.', 'error');
            setLoading(false);
            return;
          }

          if (claimedSuccessfully) {
            showToast(
              'Pickup Accepted!',
              `Order ${booking.id} assigned to your dealership. Moved to My Assigned Pickups.`,
              'success'
            );
            setLoading(false);
            onSuccess();
            onClose();
            return;
          }
        } else {
          const { error } = await supabase
            .from('bookings')
            .update(bookingUpdatePayload)
            .eq('id', booking.id);

          if (error) {
            showToast('Update Failed', error.message, 'error');
            setLoading(false);
            return;
          }

          showToast(
            'Status Updated',
            `Order ${booking.id} moved to ${targetStatus.replace('_', ' ')}.`,
            'success'
          );
        }
      } else {
        // Local sandbox fallback
        updateBookingStatus(booking.id, targetStatus, {
          note: auditNote,
          scheduledDate: bookingUpdatePayload.scheduled_date,
          scheduledTimeSlot: bookingUpdatePayload.scheduled_time_slot,
          driverNote: bookingUpdatePayload.driver_note,
          actualTotal: bookingUpdatePayload.actual_total,
          materials: itemsToUpdate.length > 0 ? itemsToUpdate : undefined,
          paymentMethod: bookingUpdatePayload.payment_method,
          paymentAmount: bookingUpdatePayload.payment_amount,
          paymentReference: bookingUpdatePayload.payment_reference,
          cancellationReason: bookingUpdatePayload.cancellation_reason,
          rescheduleReason: bookingUpdatePayload.reschedule_reason,
          rescheduledDate: bookingUpdatePayload.rescheduled_date,
          rescheduledTimeSlot: bookingUpdatePayload.rescheduled_time_slot,
        });

        showToast(
          'Status Updated',
          isClaimAction && !hasValidDealerUuid
            ? `Order ${booking.id} claimed in sandbox mode (Demo partner ${dealerId || 'N/A'} has no database UUID).`
            : `Order ${booking.id} moved to ${targetStatus.replace('_', ' ')} (Sandbox).`,
          'success'
        );
      }


      onSuccess();
      onClose();
    } catch (err: any) {
      showToast('Error', err.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getModalHeader = () => {
    switch (actionType) {
      case 'claim':
        return { title: `Accept & Claim: ${booking.id}`, subtitle: 'Assign this pickup lead to your dealership' };
      case 'schedule':
        return { title: `Schedule Pickup: ${booking.id}`, subtitle: 'Confirm collection date and time window with customer' };
      case 'on_the_way':
        return { title: `Dispatch Route: ${booking.id}`, subtitle: 'Notify customer that you are on the way to their address' };
      case 'weigh':
        return { title: `Doorstep Weighing: ${booking.id}`, subtitle: 'Record certified scale weights and agreed material rates' };
      case 'payment':
        return { title: `Settle Payout: ${booking.id}`, subtitle: 'Record instant payment made to customer' };
      case 'complete':
        return { title: `Complete Order: ${booking.id}`, subtitle: 'Finalize order and issue digital scrap recycling receipt' };
      case 'reschedule':
        return { title: `Reschedule Pickup: ${booking.id}`, subtitle: 'Propose a new date/time slot with clear explanation' };
      case 'cancel':
        return { title: `Cancel Pickup: ${booking.id}`, subtitle: 'Record cancellation reason and release this order' };
    }
  };

  const { title, subtitle } = getModalHeader();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-5 text-xs sm:text-sm">
        {/* Customer & Location Summary */}
        <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#e2e4e1] flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-[#123b26] text-sm block">{booking.address.fullName}</span>
            <span className="text-[#525955]">
              {booking.address.area}, {booking.address.city} (PIN: {booking.address.pincode})
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-[#717a75] font-semibold uppercase block">Est. Payout</span>
            <span className="font-black text-[#123b26] text-sm">{formatINR(booking.estimatedTotal)}</span>
          </div>
        </div>

        {/* 1. CLAIM ACTION */}
        {actionType === 'claim' && (
          <div className="space-y-3">
            <p className="text-xs text-[#525955] leading-relaxed">
              By claiming this pickup request, you commit to visiting the customer's doorstep during the requested time slot with a certified digital scale.
            </p>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Requested Slot: {formatDate(booking.address.preferredDate)} ({booking.address.timeSlot})</span>
            </div>
          </div>
        )}

        {/* 2. SCHEDULE ACTION */}
        {actionType === 'schedule' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#123b26] block mb-1">
                  Confirmed Pickup Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-[#123b26] block mb-1">
                  Time Slot Window <span className="text-rose-500">*</span>
                </label>
                <select
                  value={scheduledTimeSlot}
                  onChange={(e) => setScheduledTimeSlot(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] text-xs font-semibold"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[11px] text-[#717a75] italic">
              Customer's initially preferred slot was {formatDate(booking.address.preferredDate)} ({booking.address.timeSlot}).
            </p>
          </div>
        )}

        {/* 3. ON THE WAY ACTION */}
        {actionType === 'on_the_way' && (
          <div className="space-y-3">
            <label className="font-bold text-[#123b26] block">
              Driver & Vehicle Dispatch Note (Optional)
            </label>
            <textarea
              rows={3}
              value={driverNote}
              onChange={(e) => setDriverNote(e.target.value)}
              placeholder="E.g. Driver Ramesh dispatched in Electric Loader KA-01-EQ-4421. Arriving in ~15 mins."
              className="w-full px-3 py-2 rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] text-xs"
            />
            <p className="text-[11px] text-[#717a75]">
              This note is visible live in customer's order tracker.
            </p>
          </div>
        )}

        {/* 4. WEIGH ACTION */}
        {actionType === 'weigh' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#123b26]">Itemized Scale Weighing</span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                150kg Digital Scale Calibrated
              </span>
            </div>

            <div className="border border-[#e6e8e5] rounded-xl overflow-hidden divide-y divide-[#f1f3f1] text-xs">
              {weighedItems.map((item, index) => (
                <div key={item.materialId} className="p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#123b26] text-sm">{item.materialName}</span>
                    <span className="text-[#717a75]">
                      Est: {item.quantity} {item.unit}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-center">
                    <div>
                      <span className="text-[10px] text-[#717a75] block font-semibold">Actual Weight ({item.unit})</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={item.actualQuantity}
                        onChange={(e) =>
                          handleItemWeightChange(
                            index,
                            parseFloat(e.target.value) || 0,
                            item.actualRate || item.ratePerUnit
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d5db] font-bold text-xs"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-[#717a75] block font-semibold">Rate (₹/{item.unit})</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.actualRate}
                        onChange={(e) =>
                          handleItemWeightChange(
                            index,
                            item.actualQuantity || 0,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d5db] font-bold text-xs"
                      />
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#717a75] block font-semibold">Item Subtotal</span>
                      <span className="font-black text-sm text-[#123b26] block pt-1">
                        {formatINR(item.actualSubtotal || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between">
              <span className="font-bold text-emerald-950 text-xs">Verified Total Scale Payout:</span>
              <span className="text-xl font-black text-[#123b26]">{formatINR(computedTotal)}</span>
            </div>
          </div>
        )}

        {/* 5. PAYMENT ACTION */}
        {actionType === 'payment' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#eaf8ef] border border-[#bbf7d0] flex items-center justify-between">
              <span className="font-bold text-emerald-950 text-xs">Settlement Amount Due:</span>
              <span className="text-xl font-black text-[#123b26]">
                {formatINR(booking.actualTotal || computedTotal || booking.estimatedTotal)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#123b26] block mb-1">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#d1d5db] bg-white font-semibold text-xs"
                >
                  <option value="upi">Instant UPI (GPay / PhonePe / Paytm)</option>
                  <option value="cash">Hard Cash</option>
                  <option value="bank_transfer">Direct IMPS / NEFT</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#123b26] block mb-1">
                  Amount Paid (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-[#d1d5db] font-bold text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-[#123b26] block mb-1">
                Transaction Reference / UPI Ref ID (Optional)
              </label>
              <input
                type="text"
                placeholder="E.g. UPI-AXIS-992019401 or Cash receipt #104"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#d1d5db] text-xs"
              />
            </div>
          </div>
        )}

        {/* 6. COMPLETE ACTION */}
        {actionType === 'complete' && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-[#123b26]">
                <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                <span>Ready to Finalize & Archive Pickup?</span>
              </div>
              <p>
                Confirm that scrap items have been loaded onto vehicle and customer payout has been settled. The customer will receive their completed digital recycling verification.
              </p>
            </div>
          </div>
        )}

        {/* 7. RESCHEDULE ACTION */}
        {actionType === 'reschedule' && (
          <div className="space-y-4">
            <div>
              <label className="font-bold text-[#123b26] block mb-1">
                Reschedule Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="E.g. Customer requested evening time, or temporary road repair..."
                className="w-full px-3 py-2 rounded-xl border border-[#d1d5db] text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#123b26] block mb-1">Proposed New Date</label>
                <input
                  type="date"
                  value={rescheduledDate}
                  onChange={(e) => setRescheduledDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#d1d5db] text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-[#123b26] block mb-1">Proposed Time Slot</label>
                <select
                  value={rescheduledTimeSlot}
                  onChange={(e) => setRescheduledTimeSlot(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#d1d5db] text-xs font-semibold"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 8. CANCEL ACTION */}
        {actionType === 'cancel' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <span>
                Cancelling this booking will terminate collection for this order. Please provide a clear audit reason.
              </span>
            </div>

            <div>
              <label className="font-bold text-[#123b26] block mb-1">
                Cancellation Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="E.g. Customer unreachable after multiple phone attempts, address outside accessible zone..."
                className="w-full px-3 py-2 rounded-xl border border-[#d1d5db] text-xs"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f1f3f1]">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#525955] hover:bg-stone-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all flex items-center gap-1.5 active:scale-[0.98] ${
              actionType === 'cancel'
                ? 'bg-rose-600 hover:bg-rose-700'
                : actionType === 'reschedule'
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-[#123b26] hover:bg-[#16a34a]'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>
                {actionType === 'claim' && 'Accept Pickup & Confirm'}
                {actionType === 'schedule' && 'Confirm Schedule'}
                {actionType === 'on_the_way' && 'Dispatch Route'}
                {actionType === 'weigh' && 'Save Certified Weights'}
                {actionType === 'payment' && 'Confirm Payout'}
                {actionType === 'complete' && 'Finish Pickup'}
                {actionType === 'reschedule' && 'Submit Reschedule'}
                {actionType === 'cancel' && 'Confirm Cancel'}
              </span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
