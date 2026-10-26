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
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="truncate">
            <span className="font-bold text-rose-200">Cancelled: </span>
            <span>{booking.cancellationReason || 'Booking was cancelled.'}</span>
          </div>
        </div>
      );
    }

    if (isRescheduled) {
      return (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="truncate">
            <span className="font-bold text-amber-300">Rescheduled: </span>
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
        <div className="flex items-center justify-between text-xs font-semibold text-emerald-200/80">
          <span className="flex items-center gap-1.5 text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
            <span>Step {currentStepIndex} of 7: {statusDetails.label}</span>
          </span>
          <span className="text-[11px] text-emerald-300/60 font-mono">
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
                    ? 'bg-emerald-500'
                    : isCurrent
                    ? 'bg-emerald-400 animate-pulse ring-2 ring-emerald-500/40 shadow-sm shadow-emerald-400/50'
                    : 'bg-white/10'
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
    <div className="space-y-6 text-white">
      {/* Alert Banners for Cancelled or Rescheduled */}
      {isCancelled && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-200 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-white">Pickup Booking Cancelled</h4>
            <p className="text-xs text-rose-300">
              Reason:{' '}
              <strong className="text-white font-semibold">
                {booking.cancellationReason || 'Cancelled by customer or partner.'}
              </strong>
            </p>
            {getStepTimestamp('cancelled') && (
              <p className="text-[11px] text-rose-300/70 pt-0.5">
                Recorded on {formatDateTime(getStepTimestamp('cancelled')!)}
              </p>
            )}
          </div>
        </div>
      )}

      {isRescheduled && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-white">Pickup Rescheduled</h4>
            <p className="text-xs text-amber-200">
              Reason:{' '}
              <span className="font-medium">
                {booking.rescheduleReason || 'Timing adjusted by partner.'}
              </span>
            </p>
            {(booking.rescheduledDate || booking.rescheduledTimeSlot) && (
              <p className="text-xs font-bold text-emerald-300 pt-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
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
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-white/10">
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
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/20'
                    : isActive
                    ? 'bg-emerald-400 text-[#07130c] shadow-lg shadow-emerald-400/40 ring-4 ring-emerald-400/20 animate-pulse'
                    : 'bg-[#0a1b12] border-2 border-white/15 text-emerald-100/40'
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
                    ? 'bg-emerald-950/30 border-emerald-500/40 shadow-xl shadow-emerald-950/40 backdrop-blur-xl'
                    : isDone
                    ? 'glass-card border-white/[0.08]'
                    : 'bg-white/[0.02] border-white/[0.04] opacity-65'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isActive
                          ? 'bg-emerald-400 text-[#07130c]'
                          : 'bg-white/[0.06] text-[#9cb1a4]'
                      }`}
                    >
                      Step {step.stepNumber}
                    </span>
                    <h4
                      className={`text-sm font-bold ${
                        isActive
                          ? 'text-white text-base'
                          : isDone
                          ? 'text-white/90'
                          : 'text-[#9cb1a4]'
                      }`}
                    >
                      {step.label}
                    </h4>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white tracking-wider animate-pulse">
                        Active Step
                      </span>
                    )}
                  </div>

                  {timestamp && (
                    <span className="text-[11px] font-medium text-emerald-100/60 whitespace-nowrap">
                      {formatDateTime(timestamp)}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#9cb1a4] mt-1.5 leading-relaxed">
                  {step.description}
                </p>

                {/* Specific Step Custom Details */}
                {/* Step 3: Scheduled Pickup Details */}
                {step.key === 'scheduled' && (isDone || isActive) && (
                  <div className="mt-3 p-3 rounded-xl bg-white/[0.04] border border-emerald-500/30 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        Confirmed Date: {formatDate(booking.scheduledDate || booking.address.preferredDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-100/80">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Slot: {booking.scheduledTimeSlot || booking.address.timeSlot}</span>
                    </div>
                  </div>
                )}

                {/* Step 4: Dealer On The Way driver note */}
                {step.key === 'on_the_way' && (isDone || isActive) && booking.driverNote && (
                  <div className="mt-3 p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-start gap-2.5 text-xs">
                    <Truck className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold text-purple-200 block">Collection Dispatch Note</span>
                      <p className="text-purple-300/80 mt-0.5">{booking.driverNote}</p>
                    </div>
                  </div>
                )}

                {/* Step 5: Scrap collected and weighed actuals */}
                {step.key === 'collected_weighed' && (isDone || isActive) && (
                  <div className="mt-3 p-3 rounded-xl bg-teal-950/30 border border-teal-500/30 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-teal-200">
                      <span className="flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-teal-400" />
                        <span>Certified Electronic Weighing Sheet</span>
                      </span>
                      {booking.actualTotal != null && (
                        <span className="text-sm font-black text-emerald-400">
                          Verified Total: {formatINR(booking.actualTotal)}
                        </span>
                      )}
                    </div>
                    <div className="divide-y divide-white/[0.06] pt-1">
                      {booking.materials.map((m) => (
                        <div key={m.materialId} className="py-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-white/90 font-medium">{m.materialName}</span>
                          <span className="text-emerald-100/70">
                            {m.actualQuantity != null ? (
                              <span>
                                <strong className="text-white">{m.actualQuantity} {m.unit}</strong> @ {formatINR(m.actualRate ?? m.ratePerUnit)} = <strong className="text-emerald-400">{formatINR(m.actualSubtotal ?? m.estimatedSubtotal)}</strong>
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
                  <div className="mt-3 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-bold text-emerald-200 block">Instant Payout Settled</span>
                        <span className="text-[11px] text-[#9cb1a4]">
                          Method: {booking.paymentMethod ? booking.paymentMethod.toUpperCase() : 'UPI / Cash'}
                          {booking.paymentReference && ` • Ref: ${booking.paymentReference}`}
                        </span>
                      </div>
                    </div>
                    <span className="text-base font-black text-emerald-400">
                      {formatINR(booking.paymentAmount || booking.actualTotal || booking.estimatedTotal)}
                    </span>
                  </div>
                )}

                {/* Latest update note from status history if exists and not redundant */}
                {stepNote && stepNote !== step.description && (
                  <div className="mt-2 text-[11px] italic text-emerald-200/70 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/10 inline-block">
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
        <div className="p-4 rounded-2xl glass-card border border-emerald-500/25 bg-gradient-to-r from-emerald-950/20 via-white/[0.02] to-transparent space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Assigned Certified Dealer Partner</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Verified Digital Partner
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h3 className="font-bold text-base text-white">
                {booking.assignedDealer.name}
              </h3>
              <p className="text-xs text-[#9cb1a4] mt-0.5">
                {booking.assignedDealer.businessName} • Rating: ⭐ {booking.assignedDealer.rating} / 5.0
              </p>
              <p className="text-xs text-emerald-100/60 mt-0.5 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Vehicle: {booking.assignedDealer.vehicleType}</span>
              </p>
            </div>

            <a
              href={`tel:${booking.assignedDealer.phone.replace(/\s+/g, '')}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-emerald-500 text-white hover:text-[#07130c] border border-white/15 hover:border-emerald-400 shadow-md transition-all active:scale-[0.98] self-start sm:self-center"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Call Partner</span>
            </a>
          </div>
        </div>
      )}

      {/* Pickup Location & Address */}
      <div className="p-4 rounded-2xl glass-card text-xs space-y-1.5">
        <span className="font-bold text-white flex items-center gap-1.5 mb-1">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>Doorstep Pickup Destination</span>
        </span>
        <p className="font-bold text-sm text-white">{booking.address.fullName}</p>
        <p className="text-[#9cb1a4]">{booking.address.streetAddress}</p>
        <p className="text-[#9cb1a4]">
          {booking.address.area}, {booking.address.city} - {booking.address.pincode}
        </p>
        <p className="text-emerald-100/60 pt-0.5">Contact: +91 {booking.address.phoneNumber}</p>
        {booking.address.notes && (
          <p className="text-emerald-200/70 italic pt-1 border-t border-white/10">
            Special instructions: "{booking.address.notes}"
          </p>
        )}
      </div>
    </div>
  );
};
