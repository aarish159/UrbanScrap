import React from 'react';
import {
  CheckCircle2,
  Clock,
  Truck,
  Scale,
  CreditCard,
  PackageCheck,
  AlertTriangle,
  XCircle,
  Calendar,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';

import type { Booking, BookingStatus } from '../../types';
import {
  CANONICAL_TRACKING_STEPS,
  getStatusStepIndex,
  formatDate,
  formatDateTime,
  formatINR,
  getStatusDetails,
} from '../../utils/formatters';

interface PickupTrackerTimelineProps {
  booking: Booking;
  compact?: boolean;
}

export const PickupTrackerTimeline: React.FC<PickupTrackerTimelineProps> = ({
  booking,
  compact = false,
}) => {
  const currentStepIndex = getStatusStepIndex(booking.status);
  const isCancelled = booking.status === 'cancelled';
  const isRescheduled = booking.status === 'rescheduled';
  const statusDetails = getStatusDetails(booking.status);

  // Helper to find the timestamp of a specific step from history
  const getStepTimestamp = (stepKey: BookingStatus): string | undefined => {
    if (stepKey === 'requested') {
      const match = booking.statusHistory?.find((h) => h.status === 'requested');
      return match ? match.timestamp : booking.createdAt;
    }
    const match = booking.statusHistory?.find((h) => h.status === stepKey);
    return match?.timestamp;
  };

  // Helper to find note associated with a status
  const getStepNote = (stepKey: BookingStatus): string | undefined => {
    const match = booking.statusHistory?.find((h) => h.status === stepKey);
    return match?.note;
  };

  const getStepIcon = (stepKey: BookingStatus, isDone: boolean, isActive: boolean) => {
    const iconClass = isDone
      ? 'w-4 h-4 text-white'
      : isActive
      ? 'w-4 h-4 text-white'
      : 'w-3.5 h-3.5 text-stone-400';

    switch (stepKey) {
      case 'requested':
        return <Clock className={iconClass} />;
      case 'dealer_assigned':
        return <ShieldCheck className={iconClass} />;
      case 'scheduled':
        return <Calendar className={iconClass} />;
      case 'on_the_way':
        return <Truck className={iconClass} />;
      case 'collected_weighed':
        return <Scale className={iconClass} />;
      case 'payment_completed':
        return <CreditCard className={iconClass} />;
      case 'completed':
        return <PackageCheck className={iconClass} />;
      default:
        return <Clock className={iconClass} />;
    }
  };

  // ==========================================
  // COMPACT PROGRESS BAR (For Card List View)
  // ==========================================
  if (compact) {
    if (isCancelled) {
      return (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="truncate">
            <span className="font-bold">Cancelled: </span>
            <span>{booking.cancellationReason || 'Booking was cancelled.'}</span>
          </div>
        </div>
      );
    }

    if (isRescheduled) {
      return (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="truncate">
            <span className="font-bold">Rescheduled: </span>
            <span>
              {booking.rescheduleReason || 'Pickup rescheduled.'}
              {booking.rescheduledDate && ` (New Date: ${formatDate(booking.rescheduledDate)})`}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-[#525955]">
          <span className="flex items-center gap-1.5 text-[#123b26]">
            <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
            <span>Step {currentStepIndex} of 7: {statusDetails.label}</span>
          </span>
          <span className="text-[11px] text-[#717a75]">
            {Math.round((currentStepIndex / 7) * 100)}% Complete
          </span>
        </div>

        {/* 7-Segment Bar */}
        <div className="grid grid-cols-7 gap-1">
          {CANONICAL_TRACKING_STEPS.map((step) => {
            const isDone = currentStepIndex > step.stepNumber;
            const isCurrent = currentStepIndex === step.stepNumber;

            return (
              <div
                key={step.key}
                title={`Step ${step.stepNumber}: ${step.label}`}
                className={`h-1.5 rounded-full transition-all ${
                  isDone
                    ? 'bg-[#16a34a]'
                    : isCurrent
                    ? 'bg-[#16a34a] animate-pulse ring-2 ring-[#16a34a]/30'
                    : 'bg-[#e2e4e1]'
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // FULL DETAILED TRACKING TIMELINE
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Alert Banners for Cancelled or Rescheduled */}
      {isCancelled && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Pickup Booking Cancelled</h4>
            <p className="text-xs text-rose-700">
              Reason:{' '}
              <strong className="text-rose-900 font-semibold">
                {booking.cancellationReason || 'Cancelled by customer or partner.'}
              </strong>
            </p>
            {getStepTimestamp('cancelled') && (
              <p className="text-[11px] text-rose-600 pt-0.5">
                Recorded on {formatDateTime(getStepTimestamp('cancelled')!)}
              </p>
            )}
          </div>
        </div>
      )}

      {isRescheduled && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Pickup Rescheduled</h4>
            <p className="text-xs text-amber-900">
              Reason:{' '}
              <span className="font-medium">
                {booking.rescheduleReason || 'Timing adjusted by partner.'}
              </span>
            </p>
            {(booking.rescheduledDate || booking.rescheduledTimeSlot) && (
              <p className="text-xs font-bold text-[#123b26] pt-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#16a34a]" />
                <span>
                  Proposed Slot: {booking.rescheduledDate ? formatDate(booking.rescheduledDate) : ''}{' '}
                  {booking.rescheduledTimeSlot ? `• ${booking.rescheduledTimeSlot}` : ''}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* 7-Step Vertical Stepper */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#e2e4e1]">
        {CANONICAL_TRACKING_STEPS.map((step) => {
          const isDone = !isCancelled && currentStepIndex > step.stepNumber;
          const isActive = !isCancelled && currentStepIndex === step.stepNumber;
          const timestamp = getStepTimestamp(step.key);

          const stepNote = getStepNote(step.key);

          return (
            <div key={step.key} className="relative group">
              {/* Node Indicator Dot */}
              <div
                className={`absolute -left-6 sm:-left-8 top-0.5 w-6 sm:w-8 h-6 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  isDone
                    ? 'bg-[#16a34a] text-white shadow-sm ring-4 ring-emerald-100'
                    : isActive
                    ? 'bg-[#123b26] text-white shadow-md ring-4 ring-emerald-200 animate-pulse'
                    : 'bg-white border-2 border-[#d1d5db] text-stone-400'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  getStepIcon(step.key, isDone, isActive)
                )}
              </div>

              {/* Step Content Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-[#f4faf6] border-[#86efac] shadow-xs'
                    : isDone
                    ? 'bg-white border-[#e6e8e5]'
                    : 'bg-[#fafafa] border-[#efefef] opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        isDone
                          ? 'bg-emerald-100 text-emerald-900'
                          : isActive
                          ? 'bg-[#123b26] text-white'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      Step {step.stepNumber}
                    </span>
                    <h4
                      className={`text-sm font-bold ${
                        isActive
                          ? 'text-[#123b26] text-base'
                          : isDone
                          ? 'text-[#191c1a]'
                          : 'text-[#717a75]'
                      }`}
                    >
                      {step.label}
                    </h4>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#16a34a] text-white tracking-wider animate-pulse">
                        Active Step
                      </span>
                    )}
                  </div>

                  {timestamp && (
                    <span className="text-[11px] font-medium text-[#717a75] whitespace-nowrap">
                      {formatDateTime(timestamp)}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#525955] mt-1.5 leading-relaxed">
                  {step.description}
                </p>

                {/* Specific Step Custom Details */}
                {/* Step 3: Scheduled Pickup Details */}
                {step.key === 'scheduled' && (isDone || isActive) && (
                  <div className="mt-3 p-3 rounded-xl bg-white border border-[#d1fae5] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-[#123b26]">
                      <Calendar className="w-3.5 h-3.5 text-[#16a34a]" />
                      <span>
                        Confirmed Date: {formatDate(booking.scheduledDate || booking.address.preferredDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#525955]">
                      <Clock className="w-3.5 h-3.5 text-[#16a34a]" />
                      <span>Slot: {booking.scheduledTimeSlot || booking.address.timeSlot}</span>
                    </div>
                  </div>
                )}

                {/* Step 4: Dealer On The Way driver note */}
                {step.key === 'on_the_way' && (isDone || isActive) && booking.driverNote && (
                  <div className="mt-3 p-3 rounded-xl bg-white border border-purple-200 flex items-start gap-2.5 text-xs">
                    <Truck className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold text-purple-900 block">Collection Dispatch Note</span>
                      <p className="text-[#3f4541] mt-0.5">{booking.driverNote}</p>
                    </div>
                  </div>
                )}

                {/* Step 5: Scrap collected and weighed actuals */}
                {step.key === 'collected_weighed' && (isDone || isActive) && (
                  <div className="mt-3 p-3 rounded-xl bg-white border border-teal-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-teal-950">
                      <span className="flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-teal-600" />
                        <span>Certified Electronic Weighing Sheet</span>
                      </span>
                      {booking.actualTotal != null && (
                        <span className="text-sm font-black text-[#123b26]">
                          Verified Total: {formatINR(booking.actualTotal)}
                        </span>
                      )}
                    </div>
                    <div className="divide-y divide-[#f1f3f1] pt-1">
                      {booking.materials.map((m) => (
                        <div key={m.materialId} className="py-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-[#191c1a] font-medium">{m.materialName}</span>
                          <span className="text-[#525955]">
                            {m.actualQuantity != null ? (
                              <span>
                                <strong>{m.actualQuantity} {m.unit}</strong> @ {formatINR(m.actualRate ?? m.ratePerUnit)} = {formatINR(m.actualSubtotal ?? m.estimatedSubtotal)}
                              </span>
                            ) : (
                              <span>Est: {m.quantity} {m.unit}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 6: Payment Details */}
                {step.key === 'payment_completed' && (isDone || isActive) && (
                  <div className="mt-3 p-3 rounded-xl bg-white border border-emerald-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#16a34a]" />
                      <div>
                        <span className="font-bold text-emerald-950 block">Instant Payout Settled</span>
                        <span className="text-[11px] text-[#717a75]">
                          Method: {booking.paymentMethod ? booking.paymentMethod.toUpperCase() : 'UPI / Cash'}
                          {booking.paymentReference && ` • Ref: ${booking.paymentReference}`}
                        </span>
                      </div>
                    </div>
                    <span className="text-base font-black text-[#123b26]">
                      {formatINR(booking.paymentAmount || booking.actualTotal || booking.estimatedTotal)}
                    </span>
                  </div>
                )}

                {/* Latest update note from status history if exists and not redundant */}
                {stepNote && stepNote !== step.description && (
                  <div className="mt-2 text-[11px] italic text-[#717a75] bg-stone-50/80 px-2.5 py-1 rounded-lg border border-stone-200/60 inline-block">
                    Update note: "{stepNote}"
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assigned Collection Partner Card */}
      {booking.assignedDealer && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#f7faf8] to-[#edf7f1] border border-[#d1fae5] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#16a34a] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
              <span>Assigned Certified Dealer Partner</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#86efac] text-[#123b26]">
              Verified Digital Partner
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h3 className="font-bold text-base text-[#123b26]">
                {booking.assignedDealer.name}
              </h3>
              <p className="text-xs text-[#525955] mt-0.5">
                {booking.assignedDealer.businessName} • Rating: ⭐ {booking.assignedDealer.rating} / 5.0
              </p>
              <p className="text-xs text-[#717a75] mt-0.5 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-[#16a34a]" />
                <span>Vehicle: {booking.assignedDealer.vehicleType}</span>
              </p>
            </div>

            <a
              href={`tel:${booking.assignedDealer.phone.replace(/\s+/g, '')}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-[#123b26] text-[#123b26] hover:text-white border border-[#c3eed7] shadow-xs transition-all active:scale-[0.98] self-start sm:self-center"
            >
              <Phone className="w-3.5 h-3.5 text-[#16a34a]" />
              <span>Call Partner</span>
            </a>
          </div>
        </div>
      )}

      {/* Pickup Location & Address */}
      <div className="p-4 rounded-2xl bg-[#fafbfa] border border-[#e6e8e5] text-xs space-y-1.5">
        <span className="font-bold text-[#123b26] flex items-center gap-1.5 mb-1">
          <MapPin className="w-3.5 h-3.5 text-[#16a34a]" />
          <span>Doorstep Pickup Destination</span>
        </span>
        <p className="font-bold text-sm text-[#191c1a]">{booking.address.fullName}</p>
        <p className="text-[#525955]">{booking.address.streetAddress}</p>
        <p className="text-[#525955]">
          {booking.address.area}, {booking.address.city} - {booking.address.pincode}
        </p>
        <p className="text-[#717a75] pt-0.5">Contact: +91 {booking.address.phoneNumber}</p>
        {booking.address.notes && (
          <p className="text-[#717a75] italic pt-1 border-t border-[#f1f3f1]">
            Special instructions: "{booking.address.notes}"
          </p>
        )}
      </div>
    </div>
  );
};
