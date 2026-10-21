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

export function getStatusDetails(status: BookingStatus): {
  label: string;
  badgeClass: string;
  dotClass: string;
  description: string;
} {
  switch (status) {
    case 'requested':
      return {
        label: 'Requested',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 ring-amber-500/20',
        dotClass: 'bg-amber-500',
        description: 'Pickup request submitted. Waiting for local dealer acceptance.',
      };
    case 'dealer_assigned':
      return {
        label: 'Dealer Assigned',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200 ring-blue-500/20',
        dotClass: 'bg-blue-500',
        description: 'Verified scrap dealer has been assigned and notified.',
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 ring-purple-500/20',
        dotClass: 'bg-purple-500',
        description: 'Dealer is en route or at the pickup location for weighing.',
      };
    case 'completed':
      return {
        label: 'Completed',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 ring-emerald-500/20',
        dotClass: 'bg-emerald-500',
        description: 'Scrap weighed, collected, and payout completed.',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 ring-rose-500/20',
        dotClass: 'bg-rose-500',
        description: 'Pickup booking was cancelled.',
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
