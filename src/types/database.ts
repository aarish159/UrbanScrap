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
  | 'in_progress'
  | 'completed'
  | 'cancelled';

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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          phone_verified?: boolean;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          phone_verified?: boolean;
          role?: UserRole;
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
          customer_name: string;
          phone_number: string;
          email: string | null;
          street_address: string;
          area: string;
          city: string;
          pincode: string;
          preferred_date: string;
          time_slot: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          customer_id: string;
          assigned_dealer_id?: string | null;
          status?: BookingStatus;
          estimated_total?: number;
          customer_name: string;
          phone_number: string;
          email?: string | null;
          street_address: string;
          area: string;
          city: string;
          pincode: string;
          preferred_date: string;
          time_slot: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          assigned_dealer_id?: string | null;
          status?: BookingStatus;
          estimated_total?: number;
          customer_name?: string;
          phone_number?: string;
          email?: string | null;
          street_address?: string;
          area?: string;
          city?: string;
          pincode?: string;
          preferred_date?: string;
          time_slot?: string;
          notes?: string | null;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: UserRole;
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
