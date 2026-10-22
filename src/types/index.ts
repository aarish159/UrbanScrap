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
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface SelectedMaterialItem {
  materialId: string;
  materialName: string;
  category: MaterialCategory;
  quantity: number;
  unit: 'kg' | 'piece';
  ratePerUnit: number;
  estimatedSubtotal: number;
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
  address: PickupAddress;
  assignedDealer?: AssignedDealer;
  statusHistory: {
    status: BookingStatus;
    timestamp: string;
    note: string;
  }[];
  isDemoSample?: boolean;
}

export interface DealerMetrics {
  newRequestsCount: number;
  scheduledCount: number;
  completedCount: number;
  indicativeEarnings: number;
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
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}
