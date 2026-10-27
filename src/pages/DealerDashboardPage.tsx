import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  Search,
  MapPin,
  AlertCircle,
  Truck,
  Eye,
  Sparkles,
  ShieldCheck,
  X,
  Database,
  RefreshCw,
  Clock,
} from 'lucide-react';
import type { Booking, BookingStatus } from '../types';
import { DEMO_DEALER } from '../data/mockData';
import {
  getBookings,
  subscribeToBookingChanges,
} from '../utils/storage';
import { formatINR, formatDate, getStatusDetails } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { useScrollAnimation } from '../utils/useScrollAnimation';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  DealerStatusActionModal,
  type DealerActionType,
} from '../components/dealer/DealerStatusActionModal';
import { PickupTrackerTimeline } from '../components/tracking/PickupTrackerTimeline';
import { DealerOrderPhotos } from '../components/dealer/DealerOrderPhotos';
import { SAMPLE_MATERIALS } from '../data/mockData';
import type { Material } from '../types';

export const DealerDashboardPage: React.FC = () => {
  const { user, profile, isConfigured, signOut } = useAuth();

  useScrollAnimation();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentDealer, setCurrentDealer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [activeTab, setActiveTab] = useState<'assigned' | 'available'>('available');

  // Identify whether active session belongs to an authorized demo dealer account
  const isDemoDealer = Boolean(
    currentDealer?.is_demo ||
    profile?.is_demo ||
    profile?.full_name?.toLowerCase().includes('demo partner') ||
    currentDealer?.business_name?.toLowerCase().includes('demo partner')
  );

  // Default activeTab is 'available', but demo dealers can switch to 'assigned' to view claimed pickups

  // Action modal state
  const [actionModalBooking, setActionModalBooking] = useState<Booking | null>(null);
  const [actionModalType, setActionModalType] = useState<DealerActionType | null>(null);

  // Load dealer details from Supabase if authenticated
  useEffect(() => {
    if (isConfigured && isSupabaseConfigured() && user) {
      supabase
        .from('dealers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(async ({ data }) => {
          if (data) {
            setCurrentDealer(data);
          } else if (isDemoDealer) {
            // Auto-provision demo dealer record so it has a real UUID in public.dealers
            try {
              const { data: newDealer } = await (supabase.from('dealers') as any)
                .insert({
                  user_id: user.id,
                  business_name: 'UrbanScrap Demo Partner',
                  phone: '9876543210',
                  service_area: 'Bengaluru Central',
                  vehicle_type: 'Mini Electric Van',
                  rating: 4.90,
                  is_verified: false,
                  is_demo: true,
                })
                .select('*')
                .maybeSingle();

              if (newDealer) {
                setCurrentDealer(newDealer);
              }
            } catch (err) {
              console.warn('Could not auto-provision demo dealer row:', err);
            }
          }
        });
    }
  }, [isConfigured, user, isDemoDealer]);

  // Load material catalogue for scrap photo analysis
  const [materialsList, setMaterialsList] = useState<Material[]>(SAMPLE_MATERIALS);
  useEffect(() => {
    if (isConfigured && isSupabaseConfigured()) {
      supabase
        .from('materials')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setMaterialsList(
              data.map((m) => ({
                id: m.id,
                name: m.name,
                category: m.category,
                indicativeRate: Number(m.indicative_rate),
                unit: m.unit,
                description: m.description || '',
                popular: m.popular,
                minQuantity: m.min_quantity,
              }))
            );
          }
        });
    }
  }, [isConfigured]);

  // Fetch bookings function with tracking fields and dealer filtering
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    // 1. DEMO DEALER SPECIALIZED FLOW: LIVE CUSTOMER DATA VIA SECURE RPC OR DIRECT SELECT
    // Available unassigned leads (redacted contact) + Claimed pickups (unredacted contact)
    if (isConfigured && isSupabaseConfigured() && user && isDemoDealer) {
      try {
        let effectiveDealer = currentDealer;
        if (!effectiveDealer && user) {
          const { data: dData } = await supabase
            .from('dealers')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          if (dData) {
            effectiveDealer = dData;
            setCurrentDealer(dData);
          }
        }

        let rawBookings: any[] | null = null;
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_demo_dealer_bookings');

        if (rpcError) {
          console.warn('Supabase get_demo_dealer_bookings RPC error, attempting direct select:', rpcError.message);
          // Fallback to direct query permitted by bookings_select_policy:
          // Unassigned requested leads OR leads assigned to this demo dealer
          let query = (supabase.from('bookings') as any)
            .select(`
              id,
              created_at,
              status,
              estimated_total,
              actual_total,
              scheduled_pickup_at,
              scheduled_date,
              scheduled_time_slot,
              preferred_date,
              time_slot,
              customer_name,
              phone_number,
              email,
              street_address,
              area,
              city,
              pincode,
              notes,
              driver_note,
              payment_method,
              payment_amount,
              payment_reference,
              cancellation_reason,
              reschedule_reason,
              rescheduled_date,
              rescheduled_time_slot,
              assigned_dealer_id,
              photo_paths,
              booking_items (
                material_id,
                material_name,
                category,
                quantity,
                unit,
                rate_per_unit,
                estimated_subtotal,
                actual_quantity,
                actual_rate,
                actual_subtotal
              ),
              booking_status_history (
                new_status,
                note,
                created_at
              )
            `);

          if (effectiveDealer?.id) {
            query = query.or(`and(status.eq.requested,assigned_dealer_id.is.null),assigned_dealer_id.eq.${effectiveDealer.id}`);
          } else {
            query = query.eq('status', 'requested').is('assigned_dealer_id', null);
          }

          const { data: directData, error: directError } = await query.order('created_at', { ascending: false });

          if (directError) {
            console.error('Direct bookings query also failed:', directError);
            setFetchError(`Database error: ${directError.message || rpcError.message}`);
            setBookings([]);
            setLoading(false);
            return;
          }

          rawBookings = (directData || []).map((b: any) => ({
            ...b,
            items: b.booking_items || [],
            status_history: b.booking_status_history || [],
          }));
        } else {
          rawBookings = rpcData as any[];
        }

        if (rawBookings) {
          const mapped: Booking[] = rawBookings.map((b) => {
            const isAssignedToThisDealer = Boolean(
              effectiveDealer?.id &&
              (b.assigned_dealer_id === effectiveDealer.id || (b.dealers && b.dealers.id === effectiveDealer.id))
            );

            // Redact contact info in Available Lead Pool to protect privacy; reveal upon acceptance
            const isRedacted = !isAssignedToThisDealer;

            return {
              id: b.id,
              createdAt: b.created_at,
              status: b.status as BookingStatus,
              estimatedTotal: Number(b.estimated_total),
              actualTotal: b.actual_total != null ? Number(b.actual_total) : undefined,
              scheduledPickupAt: b.scheduled_pickup_at || undefined,
              scheduledDate: b.scheduled_date || undefined,
              scheduledTimeSlot: b.scheduled_time_slot || undefined,
              paymentMethod: b.payment_method || undefined,
              paymentAmount: b.payment_amount != null ? Number(b.payment_amount) : undefined,
              paymentReference: b.payment_reference || undefined,
              driverNote: b.driver_note || undefined,
              cancellationReason: b.cancellation_reason || undefined,
              rescheduleReason: b.reschedule_reason || undefined,
              rescheduledDate: b.rescheduled_date || undefined,
              rescheduledTimeSlot: b.rescheduled_time_slot || undefined,
              address: {
                fullName: isRedacted ? 'Customer (Lead Pool)' : (b.customer_name || 'Customer'),
                phoneNumber: isRedacted ? '••••••••••' : (b.phone_number || ''),
                email: isRedacted ? undefined : (b.email || undefined),
                streetAddress: isRedacted ? '•••••••••••••••• (Claim lead to view address)' : (b.street_address || ''),
                area: b.area,
                city: b.city,
                pincode: isRedacted ? '••••••' : (b.pincode || ''),
                preferredDate: b.preferred_date,
                timeSlot: b.time_slot,
                notes: isRedacted ? undefined : (b.notes || undefined),
              },
              materials: (b.items || b.booking_items || []).map((item: any) => ({
                materialId: item.material_id,
                materialName: item.material_name,
                category: item.category as any,
                quantity: Number(item.quantity),
                unit: item.unit as any,
                ratePerUnit: Number(item.rate_per_unit),
                estimatedSubtotal: Number(item.estimated_subtotal),
                actualQuantity: item.actual_quantity != null ? Number(item.actual_quantity) : undefined,
                actualRate: item.actual_rate != null ? Number(item.actual_rate) : undefined,
                actualSubtotal: item.actual_subtotal != null ? Number(item.actual_subtotal) : undefined,
              })),
              assignedDealer: isAssignedToThisDealer && effectiveDealer
                ? {
                    id: effectiveDealer.id,
                    name: effectiveDealer.business_name || 'UrbanScrap Demo Partner',
                    businessName: effectiveDealer.business_name || 'UrbanScrap Demo Partner',
                    phone: effectiveDealer.phone || '',
                    rating: Number(effectiveDealer.rating || 5.0),
                    vehicleType: effectiveDealer.vehicle_type || 'Mini Electric Van',
                    verifiedBadge: Boolean(effectiveDealer.is_verified),
                    assignedAt: b.scheduled_pickup_at || b.created_at,
                  }
                : undefined,
              statusHistory: (b.status_history || b.booking_status_history || [])
                .map((h: any) => ({
                  status: (h.new_status || h.status) as BookingStatus,
                  timestamp: h.created_at || h.timestamp,
                  note: h.note || 'Status updated',
                }))
                .sort(
                  (a: any, b: any) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                ),
              photoPaths: b.photo_paths || [],
            };
          });

          setBookings(mapped);

          // Update selected booking if currently open
          if (selectedBooking) {
            const found = mapped.find((bk) => bk.id === selectedBooking.id);
            if (found) setSelectedBooking(found);
          }
        }
      } catch (err: any) {
        console.error('Unexpected error fetching demo dealer requests:', err);
        setFetchError(err?.message || 'Network error while fetching live requests.');
        setBookings([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. STANDARD VERIFIED DEALER & ADMIN FLOW
    if (isConfigured && isSupabaseConfigured() && user) {
      try {
        const { data, error } = await (supabase.from('bookings') as any)
          .select(`
            id,
            customer_name,
            phone_number,
            email,
            street_address,
            area,
            city,
            pincode,
            preferred_date,
            time_slot,
            scheduled_pickup_at,
            scheduled_date,
            scheduled_time_slot,
            notes,
            driver_note,
            status,
            estimated_total,
            actual_total,
            payment_method,
            payment_amount,
            payment_reference,
            cancellation_reason,
            reschedule_reason,
            rescheduled_date,
            rescheduled_time_slot,
            assigned_dealer_id,
            photo_paths,
            created_at,
            booking_items (
              id,
              material_id,
              material_name,
              category,
              quantity,
              unit,
              rate_per_unit,
              estimated_subtotal,
              actual_quantity,
              actual_rate,
              actual_subtotal
            ),
            dealers (
              id,
              business_name,
              phone,
              vehicle_type,
              is_verified,
              rating
            ),
            booking_status_history (
              id,
              new_status,
              note,
              created_at
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase dealer bookings fetch failed:', error.message);
          setFetchError(`Database error: ${error.message}`);
          setBookings([]);
        } else if (data) {
          const mapped: Booking[] = (data as any[]).map((b) => ({
            id: b.id,
            createdAt: b.created_at,
            status: b.status as BookingStatus,
            estimatedTotal: Number(b.estimated_total),
            actualTotal: b.actual_total != null ? Number(b.actual_total) : undefined,
            scheduledPickupAt: b.scheduled_pickup_at || undefined,
            scheduledDate: b.scheduled_date || undefined,
            scheduledTimeSlot: b.scheduled_time_slot || undefined,
            paymentMethod: b.payment_method || undefined,
            paymentAmount: b.payment_amount != null ? Number(b.payment_amount) : undefined,
            paymentReference: b.payment_reference || undefined,
            driverNote: b.driver_note || undefined,
            cancellationReason: b.cancellation_reason || undefined,
            rescheduleReason: b.reschedule_reason || undefined,
            rescheduledDate: b.rescheduled_date || undefined,
            rescheduledTimeSlot: b.rescheduled_time_slot || undefined,
            address: {
              fullName: b.customer_name,
              phoneNumber: b.phone_number,
              email: b.email || undefined,
              streetAddress: b.street_address,
              area: b.area,
              city: b.city,
              pincode: b.pincode,
              preferredDate: b.preferred_date,
              timeSlot: b.time_slot,
              notes: b.notes || undefined,
            },
            materials: (b.booking_items || []).map((item: any) => ({
              materialId: item.material_id,
              materialName: item.material_name,
              category: item.category as any,
              quantity: Number(item.quantity),
              unit: item.unit as any,
              ratePerUnit: Number(item.rate_per_unit),
              estimatedSubtotal: Number(item.estimated_subtotal),
              actualQuantity: item.actual_quantity != null ? Number(item.actual_quantity) : undefined,
              actualRate: item.actual_rate != null ? Number(item.actual_rate) : undefined,
              actualSubtotal: item.actual_subtotal != null ? Number(item.actual_subtotal) : undefined,
            })),
            assignedDealer: b.dealers
              ? {
                  id: b.dealers.id,
                  name: b.dealers.business_name,
                  businessName: b.dealers.business_name,
                  phone: b.dealers.phone,
                  rating: Number(b.dealers.rating),
                  vehicleType: b.dealers.vehicle_type || 'Mini Electric Van',
                  verifiedBadge: b.dealers.is_verified,
                  assignedAt: b.created_at,
                }
              : undefined,
            statusHistory: (b.booking_status_history || [])
              .map((h: any) => ({
                status: h.new_status as BookingStatus,
                timestamp: h.created_at,
                note: h.note || 'Status updated',
              }))
              .sort(
                (a: any, b: any) =>
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              ),
            photoPaths: b.photo_paths || [],
          }));

          setBookings(mapped);

          // Update selected booking if currently open
          if (selectedBooking) {
            const found = mapped.find((bk) => bk.id === selectedBooking.id);
            if (found) setSelectedBooking(found);
          }
        }
      } catch (err: any) {
        console.error('Error fetching dealer bookings:', err);
        setFetchError(err?.message || 'Network error fetching dealer bookings.');
        setBookings([]);
      }
    } else {
      setBookings(getBookings());
    }
    setLoading(false);
  }, [isConfigured, user, isDemoDealer, currentDealer, selectedBooking]);

  useEffect(() => {
    fetchBookings();

    // 1. Supabase Realtime channel subscription
    let channel: any = null;
    if (isConfigured && isSupabaseConfigured() && user) {
      try {
        channel = supabase
          .channel('dealer-bookings-live')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'bookings',
            },
            () => {
              fetchBookings();
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Dealer realtime subscription error:', err);
      }
    }

    // 2. Local storage listener
    const unsubscribeStorage = subscribeToBookingChanges(fetchBookings);

    // 3. Polling interval (20s)
    const pollInterval = setInterval(() => {
      fetchBookings();
    }, 20000);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      unsubscribeStorage();
      clearInterval(pollInterval);
    };
  }, [fetchBookings, isConfigured, user]);

  // Compute assigned bookings list for current dealer (including claimed pickups by demo dealer)
  const assignedList = useMemo(() => {
    return bookings.filter((b) => {
      if (isConfigured && isSupabaseConfigured() && user) {
        if (profile?.role === 'admin') return true;
        return currentDealer
          ? b.assignedDealer?.id === currentDealer.id || (b as any).assigned_dealer_id === currentDealer.id
          : false;
      }
      // Demo sandbox: assigned to DEMO_DEALER or has assigned dealer
      return b.assignedDealer?.id === DEMO_DEALER.id || b.assignedDealer != null;
    });
  }, [bookings, currentDealer, isConfigured, user, profile]);

  const metrics = useMemo(() => {
    const unassignedCount = bookings.filter((b) => b.status === 'requested' && !b.assignedDealer).length;
    const activeAssigned = assignedList.filter(
      (b) =>
        b.status === 'dealer_assigned' ||
        b.status === 'scheduled' ||
        b.status === 'on_the_way' ||
        b.status === 'collected_weighed' ||
        b.status === 'payment_completed' ||
        b.status === 'rescheduled' ||
        b.status === 'in_progress'
    ).length;
    const completed = assignedList.filter((b) => b.status === 'completed').length;
    const earnings = assignedList
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + (b.actualTotal != null ? b.actualTotal : b.estimatedTotal), 0);

    return {
      unassignedCount,
      activeAssigned,
      completed,
      earnings,
    };
  }, [bookings, assignedList]);

  // Filtered requests list honoring tab and search
  const filteredBookings = useMemo(() => {
    const sourceList = activeTab === 'available'
      ? bookings.filter((b) => b.status === 'requested' && !b.assignedDealer)
      : assignedList;

    return sourceList.filter((b) => {
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        q === '' ||
        b.id.toLowerCase().includes(q) ||
        b.address.fullName.toLowerCase().includes(q) ||
        b.address.area.toLowerCase().includes(q) ||
        b.address.city.toLowerCase().includes(q) ||
        b.materials.some((m) => m.materialName.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [assignedList, bookings, activeTab, statusFilter, searchTerm]);

  // Open action modal (Demo dealer can claim unassigned leads and progress their assigned orders)
  const openActionModal = (booking: Booking, action: DealerActionType) => {
    setActionModalBooking(booking);
    setActionModalType(action);
  };

  const currentTabList = activeTab === 'available'
    ? bookings.filter((b) => b.status === 'requested' && !b.assignedDealer)
    : assignedList;

  const statusOptions: { value: BookingStatus | 'all'; label: string; count: number }[] = [
    {
      value: 'all',
      label: activeTab === 'available' ? 'All Available Leads' : 'All Pickups',
      count: currentTabList.length,
    },
    ...(activeTab === 'available'
      ? [
          {
            value: 'requested' as const,
            label: 'Requested',
            count: currentTabList.filter((b) => b.status === 'requested').length,
          },
        ]
      : [
          {
            value: 'dealer_assigned' as const,
            label: 'Assigned',
            count: currentTabList.filter((b) => b.status === 'dealer_assigned').length,
          },
          {
            value: 'scheduled' as const,
            label: 'Scheduled',
            count: currentTabList.filter((b) => b.status === 'scheduled').length,
          },
          {
            value: 'on_the_way' as const,
            label: 'On the Way',
            count: currentTabList.filter(
              (b) => b.status === 'on_the_way' || b.status === 'in_progress'
            ).length,
          },
          {
            value: 'collected_weighed' as const,
            label: 'Weighed',
            count: currentTabList.filter((b) => b.status === 'collected_weighed').length,
          },
          {
            value: 'payment_completed' as const,
            label: 'Paid',
            count: currentTabList.filter((b) => b.status === 'payment_completed').length,
          },
          {
            value: 'completed' as const,
            label: 'Completed',
            count: currentTabList.filter((b) => b.status === 'completed').length,
          },
          {
            value: 'rescheduled' as const,
            label: 'Rescheduled',
            count: currentTabList.filter((b) => b.status === 'rescheduled').length,
          },
          {
            value: 'cancelled' as const,
            label: 'Cancelled',
            count: currentTabList.filter((b) => b.status === 'cancelled').length,
          },
        ]),
  ];

  if (
    isConfigured &&
    isSupabaseConfigured() &&
    user &&
    profile?.role !== 'admin' &&
    currentDealer &&
    !currentDealer.is_verified &&
    !isDemoDealer
  ) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center border border-amber-200">
          <Clock className="w-8 h-8 stroke-[2.2]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-[#123b26]">Dealer Verification Pending</h2>
          <p className="text-sm text-[#525955] leading-relaxed">
            Welcome, <strong className="text-[#191c1a]">{currentDealer.business_name}</strong>! Your partner account is registered, but pending administrative verification. Access to live scrap collection routes and order claiming is locked until verified by an Urban Scrap administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in text-white">
      {/* Demo Dealer Live Requests Banner */}
      {isDemoDealer && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-white">Demo Dealer — live customer requests</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live Lead Claiming & Photo Scan Active
                </span>
              </div>
              <p className="text-[11px] text-amber-100/70 mt-0.5">
                Viewing live customer pickup requests from Supabase. You can claim available leads, scan customer scrap photos with AI, and advance orders through the pickup lifecycle. Administrative privileges remain locked.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-colors shrink-0"
          >
            Exit Demo Session
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isConfigured && isSupabaseConfigured() ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold backdrop-blur-md">
                <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Supabase Live • Role: {profile?.role ? profile.role.toUpperCase() : 'DEALER'}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Interactive Dealer Operations Sandbox</span>
              </div>
            )}

            {profile?.role === 'admin' && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-emerald-500 text-white hover:text-[#07130c] border border-white/15 text-xs font-bold shadow-sm transition-all"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Admin: Manage Dealer Applications &rarr;</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => fetchBookings()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-300 bg-white/[0.04] hover:bg-white/[0.08] rounded-full border border-white/10 shadow-sm transition-colors"
              title="Refresh requests"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Scrap Dealer Operations Portal
          </h1>
          <p className="text-sm text-[#9cb1a4] mt-1">
            Manage your assigned collection leads, pickup routes, and live weighing status updates.
          </p>
        </div>

        {/* Prototype/Live indicator */}
        <div className="px-3.5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-[#9cb1a4] flex items-center gap-2.5 self-start md:self-center shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            {isConfigured && isSupabaseConfigured()
              ? 'Row-Level-Security enforced • Authorized dealer access only'
              : 'Mock sandbox • Simulated sample partner'}
          </span>
        </div>
      </div>

      {/* Dealer Profile Card */}
      <div className="glass-card rounded-3xl p-6 sm:p-7 text-white border border-emerald-500/25 bg-gradient-to-r from-emerald-950/40 via-white/[0.02] to-transparent shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold shadow-inner shrink-0">
            <Store className="w-8 h-8 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white">
                {currentDealer?.business_name || profile?.full_name || DEMO_DEALER.name}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {isDemoDealer
                  ? 'Demo Dealer (Live Claiming)'
                  : profile?.role === 'admin'
                  ? 'System Admin'
                  : currentDealer?.is_verified
                  ? 'Verified Partner'
                  : 'Demo Partner'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                ⭐ {currentDealer?.rating || DEMO_DEALER.rating} / 5.0
              </span>
            </div>
            <p className="text-xs text-[#9cb1a4] mt-0.5">
              {currentDealer?.service_area
                ? `Operational Zone: ${currentDealer.service_area}`
                : `${DEMO_DEALER.businessName} • Operational Zone: HSR & Koramangala Ward, Bengaluru`}
            </p>
            <p className="text-xs text-emerald-100/70 mt-1 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Assigned Fleet: {currentDealer?.vehicle_type || DEMO_DEALER.vehicleType}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto border-t md:border-t-0 pt-3 md:pt-0 border-white/10">
          <div className="px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
            <span className="text-emerald-400 font-bold block">Certified Equipment</span>
            <span className="text-[#9cb1a4]">Electronic Scale (150kg certified)</span>
          </div>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1: Available Leads */}
        <div
          onClick={() => setActiveTab('available')}
          className={`rounded-2xl p-5 border shadow-sm cursor-pointer transition-all ${
            activeTab === 'available'
              ? 'bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/20'
              : 'glass-card border-white/[0.08] hover:border-amber-400/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#9cb1a4]">
            <span>{isDemoDealer ? 'Available Unassigned Leads' : 'Available Pickup Leads'}</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
              Unassigned
            </span>
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {metrics.unassignedCount}
          </div>
          <span className="text-[11px] text-[#9cb1a4] mt-1 block">Awaiting partner claiming</span>
        </div>

        {/* Metric 2: Active Assigned */}
        <div
          onClick={() => setActiveTab('assigned')}
          className={`rounded-2xl p-5 border shadow-sm cursor-pointer transition-all ${
            activeTab === 'assigned'
              ? 'bg-emerald-500/10 border-emerald-500/40 ring-2 ring-emerald-500/20'
              : 'glass-card border-white/[0.08] hover:border-emerald-400/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#9cb1a4]">
            <span>{isDemoDealer ? 'My Assigned Pickups' : 'My Active Pickups'}</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
              In Route
            </span>
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {metrics.activeAssigned}
          </div>
          <span className="text-[11px] text-[#9cb1a4] mt-1 block">
            {isDemoDealer ? 'All active in-progress customer leads' : 'Assigned / Scheduled / In Progress'}
          </span>
        </div>

        {/* Metric 3: Completed */}
        <div className="glass-card rounded-2xl p-5 border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#9cb1a4]">
            <span>Completed Pickups</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
              Settled
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-2">
            {metrics.completed}
          </div>
          <span className="text-[11px] text-[#9cb1a4] mt-1 block">Collected & recycled</span>
        </div>

        {/* Metric 4: Earnings */}
        <div className="glass-card rounded-2xl p-5 border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#9cb1a4]">
            <span>{isDemoDealer ? 'Total Pipeline Value' : 'Total Settled Payouts'}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
              {isDemoDealer ? 'Live Value' : 'Paid Out'}
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-2">
            {formatINR(metrics.earnings)}
          </div>
          <span className="text-[11px] text-[#9cb1a4] mt-1 block">
            {isDemoDealer ? 'Estimated total scrap value of lead stream' : 'Direct customer payouts settled'}
          </span>
        </div>
      </div>

      {/* Main Tab Navigation: Available Leads vs Assigned Pickups */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('available');
            setStatusFilter('all');
          }}
          className={`flex items-center gap-2 pb-2 px-1 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'available'
              ? 'border-emerald-400 text-white'
              : 'border-transparent text-[#9cb1a4] hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Available Lead Pool</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
            {metrics.unassignedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('assigned');
            setStatusFilter('all');
          }}
          className={`flex items-center gap-2 pb-2 px-1 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'assigned'
              ? 'border-emerald-400 text-white'
              : 'border-transparent text-[#9cb1a4] hover:text-white'
          }`}
        >
          <span>My Assigned Pickups</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
            {assignedList.length}
          </span>
        </button>
      </div>

      {/* Search & Status Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100/40" />
            <input
              type="text"
              placeholder="Search by ID, customer name, locality, or material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-emerald-100/30 shadow-xs transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9cb1a4] hover:text-white"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-[#9cb1a4] font-semibold">
            Showing <strong className="text-white">{filteredBookings.length}</strong> of{' '}
            {currentTabList.length} {activeTab === 'assigned' ? 'assigned orders' : 'available leads'}
          </div>
        </div>

        {/* Status Filter Tabs with Counts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {statusOptions.map((opt) => {
            const isSelected = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.98] ${
                  isSelected
                    ? 'bg-emerald-500 text-[#07130c] font-black shadow-lg shadow-emerald-500/20'
                    : 'bg-white/[0.04] text-[#9cb1a4] border border-white/10 hover:border-emerald-500/30 hover:text-white'
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-emerald-950 text-emerald-300' : 'bg-white/[0.06] text-[#9cb1a4]'
                  }`}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Retryable Error Banner */}
      {fetchError && (
        <div className="glass-card rounded-2xl p-5 border border-rose-500/30 bg-rose-500/10 text-xs text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-white block">Connection Notice:</span>
              <span>{fetchError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchBookings()}
            className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-rose-500 hover:bg-rose-400 text-white shadow-md transition-colors shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Requests Table / Cards */}
      {filteredBookings.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border border-white/[0.08] space-y-3">
          <AlertCircle className="w-10 h-10 text-emerald-100/30 mx-auto stroke-[2]" />
          <h2 className="font-bold text-base text-white">
            {isDemoDealer
              ? 'No live requests available'
              : activeTab === 'assigned'
              ? 'No assigned pickups found for this view'
              : 'No available leads currently pending'}
          </h2>
          <p className="text-xs text-[#9cb1a4] max-w-sm mx-auto">
            {isDemoDealer
              ? 'There are currently no active customer pickup requests in the database. When real customers submit requests, they will appear here in read-only mode.'
              : activeTab === 'assigned'
              ? 'Check the "Available Lead Pool" tab to claim new customer requests in your service zone.'
              : 'All incoming pickup requests in this operational area have been claimed.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              fetchBookings();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/15 border border-white/10 transition-colors"
          >
            {isDemoDealer ? 'Refresh Stream' : 'Clear Filters'}
          </button>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-white/[0.08] shadow-xl overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.06] text-[11px] font-bold uppercase tracking-wider text-[#9cb1a4]">
                  <th className="py-3.5 px-6">ID & Date</th>
                  <th className="py-3.5 px-4">Customer & Location</th>
                  <th className="py-3.5 px-4">Scheduled Slot</th>
                  <th className="py-3.5 px-4">Materials Manifest</th>
                  <th className="py-3.5 px-4">Payout Value</th>
                  <th className="py-3.5 px-4">Current Status</th>
                  <th className="py-3.5 px-6 text-right">Step Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {filteredBookings.map((req) => {
                  const statusInfo = getStatusDetails(req.status);
                  return (
                    <tr key={req.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* ID */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {isDemoDealer && (
                          <div className="mb-1">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Live customer request</span>
                            </span>
                          </div>
                        )}
                        <span className="font-extrabold text-sm text-white font-mono block">
                          {req.id}
                        </span>
                        <span className="text-[11px] text-emerald-100/50">
                          {formatDate(req.createdAt)}
                        </span>
                      </td>

                      {/* Customer & Area */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-sm text-white block">
                          {req.address.fullName}
                        </span>
                        <span className="text-[#9cb1a4] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{req.address.area}, {req.address.city}</span>
                        </span>
                        {req.address.phoneNumber.includes('••') ? (
                          <span className="text-[11px] text-[#9cb1a4] block mt-0.5 italic">
                            Contact protected in lead pool
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-100/60 block mt-0.5">
                            Ph: +91 {req.address.phoneNumber}
                          </span>
                        )}
                      </td>

                      {/* Scheduled Slot */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-semibold text-white block">
                          {formatDate(req.scheduledDate || req.address.preferredDate)}
                        </span>
                        <span className="text-[#9cb1a4]">
                          {req.scheduledTimeSlot || req.address.timeSlot}
                        </span>
                      </td>

                      {/* Materials */}
                      <td className="py-4 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {req.materials.map((m) => (
                            <span
                              key={m.materialId}
                              className="px-2 py-0.5 text-[10px] rounded-md bg-white/[0.04] border border-white/10 font-medium text-white/90"
                            >
                              {m.materialName} ({m.actualQuantity != null ? `${m.actualQuantity} ${m.unit} weighed` : `${m.quantity} ${m.unit}`})
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Value */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-black text-sm text-emerald-400 block">
                          {formatINR(req.actualTotal != null ? req.actualTotal : req.estimatedTotal)}
                        </span>
                        <span className="text-[10px] text-[#9cb1a4]">
                          {req.actualTotal != null ? 'Scale verified' : 'Indicative est.'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>

                      {/* Stepper Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {req.status === 'requested' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'claim')}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-[#07130c] shadow-md active:scale-[0.98] transition-all flex items-center gap-1.5"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Accept Pickup</span>
                            </button>
                          )}

                          {req.status === 'dealer_assigned' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'schedule')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-[0.98] transition-all"
                            >
                              Schedule Pickup
                            </button>
                          )}

                          {req.status === 'scheduled' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'on_the_way')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md active:scale-[0.98] transition-all"
                            >
                              Start Route
                            </button>
                          )}

                          {(req.status === 'on_the_way' || req.status === 'in_progress') && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'weigh')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-md active:scale-[0.98] transition-all"
                            >
                              Weigh Scrap
                            </button>
                          )}

                          {req.status === 'collected_weighed' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'payment')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-[0.98] transition-all"
                            >
                              Settle Payment
                            </button>
                          )}

                          {req.status === 'payment_completed' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'complete')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white shadow-md active:scale-[0.98] transition-all"
                            >
                              Complete
                            </button>
                          )}

                          {req.status === 'rescheduled' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'schedule')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md active:scale-[0.98] transition-all"
                            >
                              Confirm Slot
                            </button>
                          )}

                          {/* Quick Reschedule & Cancel options for in-flight pickups */}
                          {req.status !== 'requested' && req.status !== 'completed' && req.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'reschedule')}
                              className="px-2 py-1 text-[11px] font-semibold text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                              title="Reschedule Pickup"
                            >
                              Reschedule
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedBooking(req)}
                            className="p-1.5 rounded-xl text-emerald-300 hover:text-white hover:bg-white/10 transition-colors"
                            title="Inspect Order Sheet"
                            aria-label={`Inspect Order Sheet for ${req.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-white/[0.06]">
            {filteredBookings.map((req) => {
              const statusInfo = getStatusDetails(req.status);
              return (
                <div key={req.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {isDemoDealer && (
                        <div className="mb-1">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Live request</span>
                          </span>
                        </div>
                      )}
                      <span className="font-mono font-extrabold text-sm text-white">
                        {req.id}
                      </span>
                      <h4 className="font-bold text-base text-white mt-0.5">
                        {req.address.fullName}
                      </h4>
                      <p className="text-xs text-[#9cb1a4]">
                        {req.address.area}, {req.address.city}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                      <span>{statusInfo.label}</span>
                    </span>
                  </div>

                  <div className="text-xs text-[#9cb1a4] space-y-1">
                    <p>
                      <strong className="text-white">Slot:</strong>{' '}
                      {formatDate(req.scheduledDate || req.address.preferredDate)} •{' '}
                      {req.scheduledTimeSlot || req.address.timeSlot}
                    </p>
                    <p>
                      <strong className="text-white">Materials:</strong>{' '}
                      {req.materials.map((m) => `${m.materialName} (${m.actualQuantity != null ? `${m.actualQuantity} ${m.unit} weighed` : `${m.quantity} ${m.unit}`})`).join(', ')}
                    </p>
                    <p className="font-black text-sm text-emerald-400 pt-1">
                      Payout:{' '}
                      {formatINR(req.actualTotal != null ? req.actualTotal : req.estimatedTotal)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between border-t border-white/[0.06] gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedBooking(req)}
                      className="text-xs font-bold text-emerald-400 hover:underline"
                    >
                      Order Sheet &rarr;
                    </button>

                    <div className="flex items-center gap-2">
                      {req.status === 'requested' && (
                        <button
                          type="button"
                          onClick={() => openActionModal(req, 'claim')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-[#07130c] flex items-center gap-1 shadow-md"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Accept Pickup</span>
                        </button>
                      )}
                      {req.status === 'dealer_assigned' && (
                        <button
                          type="button"
                          onClick={() => openActionModal(req, 'schedule')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white"
                        >
                          Schedule
                        </button>
                      )}
                      {req.status === 'scheduled' && (
                        <button
                          type="button"
                          onClick={() => openActionModal(req, 'on_the_way')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 text-white"
                        >
                          Start Route
                        </button>
                      )}
                      {(req.status === 'on_the_way' || req.status === 'in_progress') && (
                        <button
                          type="button"
                          onClick={() => openActionModal(req, 'weigh')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-600 text-white"
                        >
                          Weigh
                        </button>
                      )}
                      {req.status === 'collected_weighed' && (
                        <button
                          type="button"
                          onClick={() => openActionModal(req, 'payment')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white"
                        >
                          Settle Pay
                        </button>
                      )}
                      {req.status === 'payment_completed' && (
                        <button
                          type="button"
                          onClick={() => openActionModal(req, 'complete')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 text-white"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL MODAL FOR DEALER INSPECTION & ORDER SHEET */}
      {selectedBooking && (
        <Modal
          isOpen={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          title={isDemoDealer ? `Live Customer Request: ${selectedBooking.id}` : `Dealer Order Sheet: ${selectedBooking.id}`}
          subtitle={
            selectedBooking.address.phoneNumber.includes('••')
              ? 'Verified Customer (Contact & address protected until lead is claimed)'
              : `Customer: ${selectedBooking.address.fullName} • Ph: +91 ${selectedBooking.address.phoneNumber}`
          }
          maxWidth="2xl"
        >
          <div className="space-y-6 text-xs sm:text-sm">
            {/* Quick Actions Stepper Bar inside modal */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#9cb1a4] block">
                  Next Order Transition
                </span>
                <span className="text-xs text-white font-semibold">
                  Current Status: {getStatusDetails(selectedBooking.status).label}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedBooking.status === 'requested' && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'claim')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-[#07130c] shadow-md flex items-center gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Accept Pickup & Assign Fleet</span>
                  </button>
                )}

                {selectedBooking.status === 'dealer_assigned' && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'schedule')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md"
                  >
                    Confirm Schedule
                  </button>
                )}

                {selectedBooking.status === 'scheduled' && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'on_the_way')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md"
                  >
                    Dispatch / On the Way
                  </button>
                )}

                {(selectedBooking.status === 'on_the_way' ||
                  selectedBooking.status === 'in_progress') && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'weigh')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-md"
                  >
                    Scale Weighing
                  </button>
                )}

                {selectedBooking.status === 'collected_weighed' && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'payment')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                  >
                    Record Payment
                  </button>
                )}

                {selectedBooking.status === 'payment_completed' && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'complete')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white shadow-md"
                  >
                    Finish Order
                  </button>
                )}

                {selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && (
                  <>
                    <button
                      type="button"
                      onClick={() => openActionModal(selectedBooking, 'reschedule')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20"
                    >
                      Reschedule
                    </button>

                    <button
                      type="button"
                      onClick={() => openActionModal(selectedBooking, 'cancel')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20"
                    >
                      Cancel Order
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Customer Attached Photos & AI Analysis */}
            {isDemoDealer && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  Live Customer Scrap Photo • Real AI Scrap Scanning (Signed URL)
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200">
                  Secure Storage
                </span>
              </div>
            )}
            <DealerOrderPhotos booking={selectedBooking} materials={materialsList} />

            {/* Embedded 7-Step Pickup Tracker Timeline */}
            <PickupTrackerTimeline booking={selectedBooking} compact={false} />

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors"
              >
                Close Order Sheet
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ACTION STEPPER MODAL */}
      {actionModalBooking && actionModalType && (
        <DealerStatusActionModal
          booking={actionModalBooking}
          actionType={actionModalType}
          isOpen={!!actionModalBooking && !!actionModalType}
          onClose={() => {
            setActionModalBooking(null);
            setActionModalType(null);
          }}
          onSuccess={() => {
            if (actionModalType === 'claim') {
              setActiveTab('assigned');
            }
            fetchBookings();
          }}
          dealerId={currentDealer?.id || ''}
          isConfigured={isConfigured}
          user={user}
        />
      )}
    </div>
  );
};

