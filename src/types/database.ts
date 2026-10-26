export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'customer' | 'dealer' | 'admin';
export type MaterialCategory = 'paper' | 'plastic' | 'metal' | 'ewaste';
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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          phone_verified: boolean;
          role: UserRole;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          phone_verified?: boolean;
          role?: UserRole;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          phone_verified?: boolean;
          role?: UserRole;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          name: string;
          category: MaterialCategory;
          indicative_rate: number;
          unit: 'kg' | 'piece';
          description: string;
          popular: boolean;
          min_quantity: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          category: MaterialCategory;
          indicative_rate: number;
          unit: 'kg' | 'piece';
          description?: string;
          popular?: boolean;
          min_quantity?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: MaterialCategory;
          indicative_rate?: number;
          unit?: 'kg' | 'piece';
          description?: string;
          popular?: boolean;
          min_quantity?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dealers: {
        Row: {
          id: string;
          user_id: string | null;
          business_name: string;
          phone: string;
          service_area: string;
          vehicle_type: string;
          rating: number;
          is_verified: boolean;
          gstin: string | null;
          legal_business_name: string | null;
          business_address: string | null;
          state: string | null;
          gst_certificate_url: string | null;
          verification_status: 'pending' | 'approved' | 'rejected';
          rejection_reason: string | null;
          review_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          submitted_at: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          business_name: string;
          phone: string;
          service_area: string;
          vehicle_type?: string;
          rating?: number;
          is_verified?: boolean;
          gstin?: string | null;
          legal_business_name?: string | null;
          business_address?: string | null;
          state?: string | null;
          gst_certificate_url?: string | null;
          verification_status?: 'pending' | 'approved' | 'rejected';
          rejection_reason?: string | null;
          review_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          submitted_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          business_name?: string;
          phone?: string;
          service_area?: string;
          vehicle_type?: string;
          rating?: number;
          is_verified?: boolean;
          gstin?: string | null;
          legal_business_name?: string | null;
          business_address?: string | null;
          state?: string | null;
          gst_certificate_url?: string | null;
          verification_status?: 'pending' | 'approved' | 'rejected';
          rejection_reason?: string | null;
          review_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          submitted_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          customer_id: string;
          assigned_dealer_id: string | null;
          status: BookingStatus;
          estimated_total: number;
          actual_total: number | null;
          customer_name: string;
          phone_number: string;
          email: string | null;
          street_address: string;
          area: string;
          city: string;
          pincode: string;
          preferred_date: string;
          time_slot: string;
          scheduled_pickup_at: string | null;
          scheduled_date: string | null;
          scheduled_time_slot: string | null;
          payment_method: 'cash' | 'upi' | 'bank_transfer' | null;
          payment_amount: number | null;
          payment_reference: string | null;
          driver_note: string | null;
          cancellation_reason: string | null;
          reschedule_reason: string | null;
          rescheduled_date: string | null;
          rescheduled_time_slot: string | null;
          notes: string | null;
          photo_paths?: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          customer_id: string;
          assigned_dealer_id?: string | null;
          status?: BookingStatus;
          estimated_total?: number;
          actual_total?: number | null;
          customer_name: string;
          phone_number: string;
          email?: string | null;
          street_address: string;
          area: string;
          city: string;
          pincode: string;
          preferred_date: string;
          time_slot: string;
          scheduled_pickup_at?: string | null;
          scheduled_date?: string | null;
          scheduled_time_slot?: string | null;
          payment_method?: 'cash' | 'upi' | 'bank_transfer' | null;
          payment_amount?: number | null;
          payment_reference?: string | null;
          driver_note?: string | null;
          cancellation_reason?: string | null;
          reschedule_reason?: string | null;
          rescheduled_date?: string | null;
          rescheduled_time_slot?: string | null;
          notes?: string | null;
          photo_paths?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          assigned_dealer_id?: string | null;
          status?: BookingStatus;
          estimated_total?: number;
          actual_total?: number | null;
          customer_name?: string;
          phone_number?: string;
          email?: string | null;
          street_address?: string;
          area?: string;
          city?: string;
          pincode?: string;
          preferred_date?: string;
          time_slot?: string;
          scheduled_pickup_at?: string | null;
          scheduled_date?: string | null;
          scheduled_time_slot?: string | null;
          payment_method?: 'cash' | 'upi' | 'bank_transfer' | null;
          payment_amount?: number | null;
          payment_reference?: string | null;
          driver_note?: string | null;
          cancellation_reason?: string | null;
          reschedule_reason?: string | null;
          rescheduled_date?: string | null;
          rescheduled_time_slot?: string | null;
          notes?: string | null;
          photo_paths?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      booking_items: {
        Row: {
          id: string;
          booking_id: string;
          material_id: string;
          material_name: string;
          category: MaterialCategory;
          quantity: number;
          unit: 'kg' | 'piece';
          rate_per_unit: number;
          estimated_subtotal: number;
          actual_quantity: number | null;
          actual_rate: number | null;
          actual_subtotal: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          material_id: string;
          material_name?: string;
          category?: MaterialCategory;
          quantity: number;
          unit?: 'kg' | 'piece';
          rate_per_unit?: number;
          estimated_subtotal?: number;
          actual_quantity?: number | null;
          actual_rate?: number | null;
          actual_subtotal?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          material_id?: string;
          material_name?: string;
          category?: MaterialCategory;
          quantity?: number;
          unit?: 'kg' | 'piece';
          rate_per_unit?: number;
          estimated_subtotal?: number;
          actual_quantity?: number | null;
          actual_rate?: number | null;
          actual_subtotal?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      booking_status_history: {
        Row: {
          id: string;
          booking_id: string;
          old_status: BookingStatus | null;
          new_status: BookingStatus;
          actor_id: string | null;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          old_status?: BookingStatus | null;
          new_status: BookingStatus;
          actor_id?: string | null;
          note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          old_status?: BookingStatus | null;
          new_status?: BookingStatus;
          actor_id?: string | null;
          note?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      dealer_reviews: {
        Row: {
          id: string;
          dealer_id: string;
          admin_id: string | null;
          action: 'submitted' | 'resubmitted' | 'approved' | 'rejected';
          rejection_reason: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          dealer_id: string;
          admin_id?: string | null;
          action: 'submitted' | 'resubmitted' | 'approved' | 'rejected';
          rejection_reason?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          dealer_id?: string;
          admin_id?: string | null;
          action?: 'submitted' | 'resubmitted' | 'approved' | 'rejected';
          rejection_reason?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: UserRole;
      };
      is_demo_dealer: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_demo_dealer_bookings: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          id: string;
          created_at: string;
          status: BookingStatus;
          estimated_total: number;
          actual_total: number | null;
          scheduled_pickup_at: string | null;
          scheduled_date: string | null;
          scheduled_time_slot: string | null;
          preferred_date: string;
          time_slot: string;
          area: string;
          city: string;
          items: Array<{
            material_id: string;
            material_name: string;
            category: MaterialCategory;
            quantity: number;
            unit: 'kg' | 'piece';
            rate_per_unit: number;
            estimated_subtotal: number;
            actual_quantity: number | null;
            actual_rate: number | null;
            actual_subtotal: number | null;
          }>;
          photo_paths: string[];
        }>;
      };
    };
    Enums: {
      user_role: UserRole;
      material_category: MaterialCategory;
      booking_status: BookingStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
