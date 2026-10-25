import type { BookingStatus, MaterialCategory } from '../types';

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export interface TrackingStepDef {
  key: BookingStatus;
  stepNumber: number;
  label: string;
  shortLabel: string;
  description: string;
}

export const CANONICAL_TRACKING_STEPS: TrackingStepDef[] = [
  {
    key: 'requested',
    stepNumber: 1,
    label: 'Pickup Requested',
    shortLabel: 'Requested',
    description: 'Pickup request submitted. Waiting for local collection partner.',
  },
  {
    key: 'dealer_assigned',
    stepNumber: 2,
    label: 'Dealer Assigned',
    shortLabel: 'Assigned',
    description: 'Verified collection partner assigned to your pickup.',
  },
  {
    key: 'scheduled',
    stepNumber: 3,
    label: 'Pickup Scheduled',
    shortLabel: 'Scheduled',
    description: 'Pickup date and time confirmed by collection partner.',
  },
  {
    key: 'on_the_way',
    stepNumber: 4,
    label: 'Dealer On The Way',
    shortLabel: 'On the Way',
    description: 'Partner is en route to your doorstep location.',
  },
  {
    key: 'collected_weighed',
    stepNumber: 5,
    label: 'Scrap Collected & Weighed',
    shortLabel: 'Weighed',
    description: 'Materials inspected and weighed on certified digital scale.',
  },
  {
    key: 'payment_completed',
    stepNumber: 6,
    label: 'Payment Completed',
    shortLabel: 'Paid',
    description: 'Payout settled via instant UPI / Cash.',
  },
  {
    key: 'completed',
    stepNumber: 7,
    label: 'Pickup Completed',
    shortLabel: 'Completed',
    description: 'Doorstep collection and scrap handover finished.',
  },
];

export function getStatusStepIndex(status: BookingStatus): number {
  switch (status) {
    case 'requested':
      return 1;
    case 'dealer_assigned':
      return 2;
    case 'scheduled':
      return 3;
    case 'on_the_way':
    case 'in_progress':
      return 4;
    case 'collected_weighed':
      return 5;
    case 'payment_completed':
      return 6;
    case 'completed':
      return 7;
    default:
      return 0; // cancelled or rescheduled
  }
}

export function getStatusDetails(status: BookingStatus): {
  label: string;
  badgeClass: string;
  dotClass: string;
  description: string;
} {
  switch (status) {
    case 'requested':
      return {
        label: 'Pickup Requested',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-200 ring-amber-500/20',
        dotClass: 'bg-amber-500',
        description: 'Pickup request submitted. Waiting for local dealer acceptance.',
      };
    case 'dealer_assigned':
      return {
        label: 'Dealer Assigned',
        badgeClass: 'bg-blue-50 text-blue-900 border-blue-200 ring-blue-500/20',
        dotClass: 'bg-blue-500',
        description: 'Verified scrap dealer has been assigned and notified.',
      };
    case 'scheduled':
      return {
        label: 'Pickup Scheduled',
        badgeClass: 'bg-indigo-50 text-indigo-900 border-indigo-200 ring-indigo-500/20',
        dotClass: 'bg-indigo-500',
        description: 'Pickup time slot confirmed by dealer partner.',
      };
    case 'on_the_way':
      return {
        label: 'Dealer On The Way',
        badgeClass: 'bg-purple-50 text-purple-900 border-purple-200 ring-purple-500/20',
        dotClass: 'bg-purple-500 animate-pulse',
        description: 'Dealer vehicle is en route to your doorstep location.',
      };
    case 'collected_weighed':
      return {
        label: 'Collected & Weighed',
        badgeClass: 'bg-teal-50 text-teal-900 border-teal-200 ring-teal-500/20',
        dotClass: 'bg-teal-500',
        description: 'Scrap weighed on certified digital scale; awaiting payout settlement.',
      };
    case 'payment_completed':
      return {
        label: 'Payment Completed',
        badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200 ring-emerald-500/20',
        dotClass: 'bg-emerald-500',
        description: 'Payout settled via instant UPI or cash.',
      };
    case 'completed':
      return {
        label: 'Pickup Completed',
        badgeClass: 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-emerald-600/20',
        dotClass: 'bg-emerald-600',
        description: 'Scrap collected, weighed, paid, and recycled.',
      };
    case 'rescheduled':
      return {
        label: 'Rescheduled',
        badgeClass: 'bg-orange-50 text-orange-900 border-orange-200 ring-orange-500/20',
        dotClass: 'bg-orange-500',
        description: 'Pickup slot has been rescheduled to a revised timing.',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-rose-50 text-rose-900 border-rose-200 ring-rose-500/20',
        dotClass: 'bg-rose-500',
        description: 'Pickup booking was cancelled.',
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        badgeClass: 'bg-purple-50 text-purple-900 border-purple-200 ring-purple-500/20',
        dotClass: 'bg-purple-500',
        description: 'Dealer is en route or at the pickup location for weighing.',
      };
    default:
      return {
        label: status,
        badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
        dotClass: 'bg-gray-400',
        description: '',
      };
  }
}

export function getCategoryBadge(category: MaterialCategory): {
  label: string;
  colorClass: string;
} {
  switch (category) {
    case 'paper':
      return { label: 'Paper & Cardboard', colorClass: 'bg-amber-100/70 text-amber-900 border-amber-200' };
    case 'plastic':
      return { label: 'Plastic', colorClass: 'bg-sky-100/70 text-sky-900 border-sky-200' };
    case 'metal':
      return { label: 'Metals', colorClass: 'bg-slate-200/80 text-slate-900 border-slate-300' };
    case 'ewaste':
      return { label: 'E-Waste', colorClass: 'bg-emerald-100/70 text-emerald-900 border-emerald-200' };
  }
}
