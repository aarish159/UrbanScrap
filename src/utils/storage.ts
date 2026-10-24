import type { Booking, BookingStatus, DealerApplication, DealerReview } from '../types';
import { SEED_BOOKINGS, DEMO_DEALER, SAMPLE_DEALER_APPLICATIONS } from '../data/mockData';

const STORAGE_KEY = 'urban_scrap_bookings_v1';
const DEALERS_STORAGE_KEY = 'urban_scrap_dealers_v1';
const EVENT_NAME = 'urban-scrap-storage-change';
const DEALER_EVENT_NAME = 'urban-scrap-dealers-change';

let memoryDealers: DealerApplication[] | null = null;

// In-memory fallback if localStorage is disabled or throws
let memoryBookings: Booking[] | null = null;

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function getBookings(): Booking[] {
  if (!isLocalStorageAvailable()) {
    if (!memoryBookings) {
      memoryBookings = [...SEED_BOOKINGS];
    }
    return memoryBookings;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // First run: seed demo bookings so user can explore history and dealer portal immediately
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_BOOKINGS));
      return SEED_BOOKINGS;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_BOOKINGS));
      return SEED_BOOKINGS;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to parse bookings from localStorage, using seed data:', error);
    return SEED_BOOKINGS;
  }
}

export function getBookingById(id: string): Booking | undefined {
  const bookings = getBookings();
  return bookings.find((b) => b.id.toLowerCase() === id.toLowerCase());
}

export function saveBooking(booking: Booking): void {
  const current = getBookings();
  const updated = [booking, ...current];

  if (!isLocalStorageAvailable()) {
    memoryBookings = updated;
  } else {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('LocalStorage write error:', e);
      memoryBookings = updated;
    }
  }

  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { action: 'save', booking } }));
}

export function updateBookingStatus(
  bookingId: string,
  newStatus: BookingStatus,
  note?: string
): Booking | null {
  const current = getBookings();
  const index = current.findIndex((b) => b.id === bookingId);
  if (index === -1) return null;

  const target = current[index];
  const historyEntry = {
    status: newStatus,
    timestamp: new Date().toISOString(),
    note:
      note ||
      (newStatus === 'dealer_assigned'
        ? 'Assigned to demo dealer partner.'
        : newStatus === 'in_progress'
        ? 'Scrap dealer en route to location.'
        : newStatus === 'completed'
        ? 'Pickup completed and weighing settled.'
        : newStatus === 'cancelled'
        ? 'Cancelled by customer / partner.'
        : `Status changed to ${newStatus}`),
  };

  const updatedBooking: Booking = {
    ...target,
    status: newStatus,
    assignedDealer:
      target.assignedDealer || (newStatus !== 'cancelled' ? DEMO_DEALER : undefined),
    statusHistory: [...(target.statusHistory || []), historyEntry],
  };

  current[index] = updatedBooking;

  if (!isLocalStorageAvailable()) {
    memoryBookings = current;
  } else {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      console.error('LocalStorage update error:', e);
      memoryBookings = current;
    }
  }

  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { action: 'update', booking: updatedBooking } })
  );
  return updatedBooking;
}

export function subscribeToBookingChanges(callback: () => void): () => void {
  const listener = () => callback();
  window.addEventListener(EVENT_NAME, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    window.removeEventListener('storage', listener);
  };
}

// ====================================================================
// DEALER APPLICATIONS STORAGE (For local demo & offline management)
// ====================================================================

export function getDealerApplications(): DealerApplication[] {
  if (!isLocalStorageAvailable()) {
    if (!memoryDealers) {
      memoryDealers = [...SAMPLE_DEALER_APPLICATIONS];
    }
    return memoryDealers;
  }

  try {
    const stored = window.localStorage.getItem(DEALERS_STORAGE_KEY);
    if (!stored) {
      window.localStorage.setItem(
        DEALERS_STORAGE_KEY,
        JSON.stringify(SAMPLE_DEALER_APPLICATIONS)
      );
      return SAMPLE_DEALER_APPLICATIONS;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem(
        DEALERS_STORAGE_KEY,
        JSON.stringify(SAMPLE_DEALER_APPLICATIONS)
      );
      return SAMPLE_DEALER_APPLICATIONS;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to parse dealer applications from localStorage:', error);
    return SAMPLE_DEALER_APPLICATIONS;
  }
}

export function saveDealerApplication(app: DealerApplication): void {
  const current = getDealerApplications();
  const updated = [app, ...current.filter((d) => d.id !== app.id)];

  if (!isLocalStorageAvailable()) {
    memoryDealers = updated;
  } else {
    try {
      window.localStorage.setItem(DEALERS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('LocalStorage update error:', e);
      memoryDealers = updated;
    }
  }

  window.dispatchEvent(
    new CustomEvent(DEALER_EVENT_NAME, { detail: { action: 'create', app } })
  );
}

const REVIEWS_STORAGE_KEY = 'urban_scrap_dealer_reviews_v1';
let memoryReviews: DealerReview[] | null = null;

export function getDealerReviews(dealerId?: string): DealerReview[] {
  let all: DealerReview[] = [];
  if (!isLocalStorageAvailable()) {
    all = memoryReviews || [];
  } else {
    try {
      const stored = window.localStorage.getItem(REVIEWS_STORAGE_KEY);
      all = stored ? JSON.parse(stored) : [];
    } catch {
      all = [];
    }
  }

  if (dealerId) {
    return all.filter((r) => r.dealerId === dealerId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function saveDealerReview(review: DealerReview): void {
  const current = getDealerReviews();
  const updated = [review, ...current];

  if (!isLocalStorageAvailable()) {
    memoryReviews = updated;
  } else {
    try {
      window.localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('LocalStorage write error for reviews:', e);
      memoryReviews = updated;
    }
  }
}

export function submitDealerGstDetails(params: {
  dealerId: string;
  gstin: string;
  legalBusinessName: string;
  businessAddress: string;
  state: string;
  gstCertificateUrl?: string | null;
}): DealerApplication | null {
  const current = getDealerApplications();
  const index = current.findIndex((d) => d.id === params.dealerId || d.userId === params.dealerId);
  if (index === -1) return null;

  const target = current[index];
  const isResubmission = target.status === 'rejected';

  const updatedApp: DealerApplication = {
    ...target,
    gstin: params.gstin.trim().toUpperCase(),
    legalBusinessName: params.legalBusinessName.trim(),
    businessAddress: params.businessAddress.trim(),
    state: params.state.trim(),
    gstCertificateUrl: params.gstCertificateUrl || target.gstCertificateUrl || null,
    status: 'pending',
    isVerified: false,
    rejectionReason: null, // Cleared on resubmission
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  current[index] = updatedApp;

  if (!isLocalStorageAvailable()) {
    memoryDealers = current;
  } else {
    try {
      window.localStorage.setItem(DEALERS_STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      console.error('LocalStorage update error:', e);
      memoryDealers = current;
    }
  }

  // Audit review trail
  saveDealerReview({
    id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    dealerId: target.id,
    action: isResubmission ? 'resubmitted' : 'submitted',
    notes: isResubmission ? 'Dealer updated and resubmitted GST credentials after rejection.' : 'Initial GST registration credentials submitted.',
    createdAt: new Date().toISOString(),
  });

  window.dispatchEvent(
    new CustomEvent(DEALER_EVENT_NAME, { detail: { action: 'update', app: updatedApp } })
  );
  return updatedApp;
}

export function updateDealerApplicationStatus(
  id: string,
  newStatus: 'approved' | 'rejected' | 'verified',
  options?: {
    rejectionReason?: string;
    reviewNotes?: string;
    adminId?: string;
  }
): DealerApplication | null {
  const current = getDealerApplications();
  const index = current.findIndex((d) => d.id === id);
  if (index === -1) return null;

  const target = current[index];
  const canonicalStatus = newStatus === 'verified' || newStatus === 'approved' ? 'approved' : 'rejected';
  const nowIso = new Date().toISOString();

  const updatedApp: DealerApplication = {
    ...target,
    status: canonicalStatus,
    isVerified: canonicalStatus === 'approved',
    rejectionReason: canonicalStatus === 'rejected' ? options?.rejectionReason || 'Application rejected by administration.' : null,
    reviewNotes: options?.reviewNotes || null,
    reviewedBy: options?.adminId || 'admin',
    reviewedAt: nowIso,
    updatedAt: nowIso,
  };

  current[index] = updatedApp;

  if (!isLocalStorageAvailable()) {
    memoryDealers = current;
  } else {
    try {
      window.localStorage.setItem(DEALERS_STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      console.error('LocalStorage update error:', e);
      memoryDealers = current;
    }
  }

  // Audit review trail
  saveDealerReview({
    id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    dealerId: target.id,
    adminId: options?.adminId || 'admin',
    action: canonicalStatus,
    rejectionReason: canonicalStatus === 'rejected' ? options?.rejectionReason : undefined,
    notes: options?.reviewNotes,
    createdAt: nowIso,
  });

  window.dispatchEvent(
    new CustomEvent(DEALER_EVENT_NAME, { detail: { action: 'update', app: updatedApp } })
  );
  return updatedApp;
}

export function subscribeToDealerChanges(callback: () => void): () => void {
  const listener = () => callback();
  window.addEventListener(DEALER_EVENT_NAME, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(DEALER_EVENT_NAME, listener);
    window.removeEventListener('storage', listener);
  };
}
