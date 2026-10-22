import type { Booking, BookingStatus, DealerApplication } from '../types';
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

export function updateDealerApplicationStatus(
  id: string,
  newStatus: 'verified' | 'rejected',
  rejectionReason?: string
): DealerApplication | null {
  const current = getDealerApplications();
  const index = current.findIndex((d) => d.id === id);
  if (index === -1) return null;

  const target = current[index];
  const updatedApp: DealerApplication = {
    ...target,
    status: newStatus,
    isVerified: newStatus === 'verified',
    rejectionReason: newStatus === 'rejected' ? rejectionReason || 'Application rejected by administration.' : undefined,
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
