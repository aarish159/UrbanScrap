export type MaterialCategory = 'paper' | 'plastic' | 'metal' | 'ewaste';

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  indicativeRate: number; // in INR
  unit: 'kg' | 'piece';
  description: string;
  popular?: boolean;
  minQuantity?: number;
  iconName?: string;
}

export type BookingStatus =
  | 'requested'
  | 'dealer_assigned'
  | 'scheduled'
  | 'on_the_way'
  | 'collected_weighed'
  | 'payment_completed'
  | 'completed'
  | 'rescheduled'
  | 'cancelled'
  | 'in_progress';

export interface SelectedMaterialItem {
  materialId: string;
  materialName: string;
  category: MaterialCategory;
  quantity: number;
  unit: 'kg' | 'piece';
  ratePerUnit: number;
  estimatedSubtotal: number;
  actualQuantity?: number;
  actualRate?: number;
  actualSubtotal?: number;
}

export interface PickupAddress {
  fullName: string;
  phoneNumber: string;
  email?: string;
  streetAddress: string;
  area: string;
  city: string;
  pincode: string;
  preferredDate: string;
  timeSlot: string;
  notes?: string;
}

export interface AssignedDealer {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  rating: number;
  vehicleType: string;
  verifiedBadge: boolean;
  assignedAt: string;
}

export interface Booking {
  id: string;
  createdAt: string;
  status: BookingStatus;
  materials: SelectedMaterialItem[];
  estimatedTotal: number;
  actualTotal?: number;
  address: PickupAddress;
  assignedDealer?: AssignedDealer;
  scheduledPickupAt?: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  paymentMethod?: 'cash' | 'upi' | 'bank_transfer';
  paymentAmount?: number;
  paymentReference?: string;
  driverNote?: string;
  cancellationReason?: string;
  rescheduleReason?: string;
  rescheduledDate?: string;
  rescheduledTimeSlot?: string;
  statusHistory: {
    status: BookingStatus;
    timestamp: string;
    note: string;
  }[];
  photoPaths?: string[];
  photoUrls?: string[];
  isDemoSample?: boolean;
}

export interface DealerMetrics {
  newRequestsCount: number;
  scheduledCount: number;
  completedCount: number;
  indicativeEarnings: number;
}

export type DealerVerificationStatus = 'pending' | 'approved' | 'rejected' | 'verified';

export interface DealerReview {
  id: string;
  dealerId: string;
  adminId?: string | null;
  action: 'submitted' | 'resubmitted' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface DealerApplication {
  id: string;
  userId?: string | null;
  businessName: string;
  applicantName: string;
  email: string;
  phone: string;
  serviceArea: string;
  vehicleType: string;
  rating: number;
  isVerified: boolean;
  status: DealerVerificationStatus;
  gstin?: string | null;
  legalBusinessName?: string | null;
  businessAddress?: string | null;
  state?: string | null;
  gstCertificateUrl?: string | null;
  rejectionReason?: string | null;
  reviewNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
}


