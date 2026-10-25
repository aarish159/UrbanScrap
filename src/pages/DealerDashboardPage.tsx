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

export const DealerDashboardPage: React.FC = () => {
  const { user, profile, isConfigured } = useAuth();

  useScrollAnimation();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentDealer, setCurrentDealer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [activeTab, setActiveTab] = useState<'assigned' | 'available'>('assigned');

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
        .then(({ data }) => {
          if (data) setCurrentDealer(data);
        });
    }
  }, [isConfigured, user]);

  // Fetch bookings function with tracking fields and dealer filtering
  const fetchBookings = useCallback(async () => {
    setLoading(true);
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
          console.warn('Supabase dealer bookings fetch failed, using local demo data:', error.message);
          setBookings(getBookings());
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
          }));

          setBookings(mapped);

          // Update selected booking if currently open
          if (selectedBooking) {
            const found = mapped.find((bk) => bk.id === selectedBooking.id);
            if (found) setSelectedBooking(found);
          }
        }
      } catch (err) {
        console.warn('Error fetching dealer bookings:', err);
        setBookings(getBookings());
      }
    } else {
      setBookings(getBookings());
    }
    setLoading(false);
  }, [isConfigured, user, selectedBooking]);

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

  // Compute metrics based on assigned bookings
  const assignedList = useMemo(() => {
    return bookings.filter((b) => {
      if (isConfigured && isSupabaseConfigured() && user) {
        if (profile?.role === 'admin') return true;
        return currentDealer ? b.assignedDealer?.id === currentDealer.id : false;
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
    const sourceList = activeTab === 'assigned' ? assignedList : bookings.filter((b) => b.status === 'requested' && !b.assignedDealer);

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

  // Open action modal
  const openActionModal = (booking: Booking, action: DealerActionType) => {
    setActionModalBooking(booking);
    setActionModalType(action);
  };

  const currentTabList =
    activeTab === 'assigned'
      ? assignedList
      : bookings.filter((b) => b.status === 'requested' && !b.assignedDealer);

  const statusOptions: { value: BookingStatus | 'all'; label: string; count: number }[] = [
    { value: 'all', label: 'All Pickups', count: currentTabList.length },
    {
      value: 'dealer_assigned',
      label: 'Assigned',
      count: currentTabList.filter((b) => b.status === 'dealer_assigned').length,
    },
    {
      value: 'scheduled',
      label: 'Scheduled',
      count: currentTabList.filter((b) => b.status === 'scheduled').length,
    },
    {
      value: 'on_the_way',
      label: 'On the Way',
      count: currentTabList.filter(
        (b) => b.status === 'on_the_way' || b.status === 'in_progress'
      ).length,
    },
    {
      value: 'collected_weighed',
      label: 'Weighed',
      count: currentTabList.filter((b) => b.status === 'collected_weighed').length,
    },
    {
      value: 'payment_completed',
      label: 'Paid',
      count: currentTabList.filter((b) => b.status === 'payment_completed').length,
    },
    {
      value: 'completed',
      label: 'Completed',
      count: currentTabList.filter((b) => b.status === 'completed').length,
    },
    {
      value: 'rescheduled',
      label: 'Rescheduled',
      count: currentTabList.filter((b) => b.status === 'rescheduled').length,
    },
    {
      value: 'cancelled',
      label: 'Cancelled',
      count: currentTabList.filter((b) => b.status === 'cancelled').length,
    },
  ];

  if (
    isConfigured &&
    isSupabaseConfigured() &&
    user &&
    profile?.role !== 'admin' &&
    currentDealer &&
    !currentDealer.is_verified
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isConfigured && isSupabaseConfigured() ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-bold">
                <Database className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>
                  Supabase Live • Role: {profile?.role ? profile.role.toUpperCase() : 'DEALER'}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Interactive Dealer Operations Sandbox</span>
              </div>
            )}

            {(profile?.role === 'admin' || !isConfigured) && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#123b26] text-white hover:bg-[#1a5336] text-xs font-bold shadow-2xs transition-all"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#4ade80]" />
                <span>Admin: Manage Dealer Applications &rarr;</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => fetchBookings()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-900 bg-white/80 hover:bg-white rounded-full border border-emerald-300 shadow-2xs transition-colors"
              title="Refresh requests"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
          <h1 className="text-3xl font-extrabold text-[#123b26] tracking-tight">
            Scrap Dealer Operations Portal
          </h1>
          <p className="text-sm text-[#525955] mt-1">
            Manage your assigned collection leads, pickup routes, and live weighing status updates.
          </p>
        </div>

        {/* Prototype/Live indicator */}
        <div className="px-3.5 py-2.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-xs text-amber-900 flex items-center gap-2.5 self-start md:self-center shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {isConfigured && isSupabaseConfigured()
              ? 'Row-Level-Security enforced • Authorized dealer access only'
              : 'Mock sandbox • Simulated sample partner'}
          </span>
        </div>
      </div>

      {/* Dealer Profile Card */}
      <div className="bg-gradient-to-r from-[#123b26] to-[#1a5336] rounded-3xl p-6 sm:p-7 text-white shadow-lg shadow-[#123b26]/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#22c55e] text-[#123b26] flex items-center justify-center font-bold shadow-inner shrink-0">
            <Store className="w-8 h-8 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white">
                {currentDealer?.business_name || profile?.full_name || DEMO_DEALER.name}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#86efac] text-[#123b26]">
                {profile?.role === 'admin'
                  ? 'System Admin'
                  : currentDealer?.is_verified
                  ? 'Verified Partner'
                  : 'Demo Partner'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-300 text-stone-950">
                ⭐ {currentDealer?.rating || DEMO_DEALER.rating} / 5.0
              </span>
            </div>
            <p className="text-xs text-[#cad5ce] mt-0.5">
              {currentDealer?.service_area
                ? `Operational Zone: ${currentDealer.service_area}`
                : `${DEMO_DEALER.businessName} • Operational Zone: HSR & Koramangala Ward, Bengaluru`}
            </p>
            <p className="text-xs text-[#a7b5ad] mt-1 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#86efac] shrink-0" />
              <span>
                Assigned Fleet: {currentDealer?.vehicle_type || DEMO_DEALER.vehicleType}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto border-t md:border-t-0 pt-3 md:pt-0 border-[#246944]">
          <div className="px-4 py-2.5 rounded-xl bg-[#0a2417] border border-[#236843] text-xs">
            <span className="text-[#86efac] font-bold block">Certified Equipment</span>
            <span className="text-[#cad5ce]">Electronic Scale (150kg certified)</span>
          </div>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1: Available Leads */}
        <div
          onClick={() => setActiveTab('available')}
          className={`rounded-2xl p-5 border shadow-xs cursor-pointer transition-all ${
            activeTab === 'available'
              ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-400'
              : 'bg-white border-[#e6e8e5] hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#717a75]">
            <span>Available Pickup Leads</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
              Unassigned
            </span>
          </div>
          <div className="text-3xl font-black text-[#123b26] mt-2">
            {metrics.unassignedCount}
          </div>
          <span className="text-[11px] text-[#9aa19d] mt-1 block">Awaiting partner claiming</span>
        </div>

        {/* Metric 2: Active Assigned */}
        <div
          onClick={() => setActiveTab('assigned')}
          className={`rounded-2xl p-5 border shadow-xs cursor-pointer transition-all ${
            activeTab === 'assigned'
              ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-400'
              : 'bg-white border-[#e6e8e5] hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#717a75]">
            <span>My Active Pickups</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-bold">
              In Route
            </span>
          </div>
          <div className="text-3xl font-black text-[#123b26] mt-2">
            {metrics.activeAssigned}
          </div>
          <span className="text-[11px] text-[#9aa19d] mt-1 block">Assigned / Scheduled / In Progress</span>
        </div>

        {/* Metric 3: Completed */}
        <div className="bg-white rounded-2xl p-5 border border-[#e6e8e5] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#717a75]">
            <span>Completed Pickups</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
              Settled
            </span>
          </div>
          <div className="text-3xl font-black text-[#16a34a] mt-2">
            {metrics.completed}
          </div>
          <span className="text-[11px] text-[#9aa19d] mt-1 block">Collected & recycled</span>
        </div>

        {/* Metric 4: Earnings */}
        <div className="bg-white rounded-2xl p-5 border border-[#e6e8e5] shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#717a75]">
            <span>Total Settled Payouts</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
              Paid Out
            </span>
          </div>
          <div className="text-3xl font-black text-[#123b26] mt-2">
            {formatINR(metrics.earnings)}
          </div>
          <span className="text-[11px] text-[#9aa19d] mt-1 block">Direct customer payouts settled</span>
        </div>
      </div>

      {/* Main Tab Navigation: Assigned vs Available Leads */}
      <div className="flex items-center gap-3 border-b border-[#e2e4e1] pb-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('assigned');
            setStatusFilter('all');
          }}
          className={`flex items-center gap-2 pb-2 px-1 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'assigned'
              ? 'border-[#16a34a] text-[#123b26]'
              : 'border-transparent text-[#717a75] hover:text-[#191c1a]'
          }`}
        >
          <span>My Assigned Pickups</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-[#eaf8ef] text-[#16a34a] font-mono">
            {assignedList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('available');
            setStatusFilter('all');
          }}
          className={`flex items-center gap-2 pb-2 px-1 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'available'
              ? 'border-[#16a34a] text-[#123b26]'
              : 'border-transparent text-[#717a75] hover:text-[#191c1a]'
          }`}
        >
          <span>Available Lead Pool</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-900 font-mono">
            {metrics.unassignedCount}
          </span>
        </button>
      </div>

      {/* Search & Status Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
            <input
              type="text"
              placeholder="Search by ID, customer name, locality, or material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] text-[#191c1a] shadow-xs transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#717a75] hover:text-[#191c1a]"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-[#717a75] font-semibold">
            Showing <strong className="text-[#123b26]">{filteredBookings.length}</strong> of{' '}
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
                    ? 'bg-[#123b26] text-white shadow-sm'
                    : 'bg-white text-[#525955] border border-[#d1d5db] hover:border-[#123b26] hover:bg-[#eef2ee]'
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-[#17482f] text-[#86efac]' : 'bg-[#f1f3f1] text-[#717a75]'
                  }`}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Requests Table / Cards */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-[#e6e8e5] space-y-3">
          <AlertCircle className="w-10 h-10 text-[#9aa19d] mx-auto stroke-[2]" />
          <h2 className="font-bold text-base text-[#123b26]">
            {activeTab === 'assigned'
              ? 'No assigned pickups found for this view'
              : 'No available leads currently pending'}
          </h2>
          <p className="text-xs text-[#717a75] max-w-sm mx-auto">
            {activeTab === 'assigned'
              ? 'Check the "Available Lead Pool" tab to claim new customer requests in your service zone.'
              : 'All incoming pickup requests in this operational area have been claimed.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#f1f3f1] text-[#191c1a] hover:bg-[#e2e4e1] transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e6e8e5] shadow-xs overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8faf9] border-b border-[#e6e8e5] text-[11px] font-bold uppercase tracking-wider text-[#717a75]">
                  <th className="py-3.5 px-6">ID & Date</th>
                  <th className="py-3.5 px-4">Customer & Location</th>
                  <th className="py-3.5 px-4">Scheduled Slot</th>
                  <th className="py-3.5 px-4">Materials Manifest</th>
                  <th className="py-3.5 px-4">Payout Value</th>
                  <th className="py-3.5 px-4">Current Status</th>
                  <th className="py-3.5 px-6 text-right">Step Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f1] text-xs">
                {filteredBookings.map((req) => {
                  const statusInfo = getStatusDetails(req.status);
                  return (
                    <tr key={req.id} className="hover:bg-[#fbfbf9] transition-colors">
                      {/* ID */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="font-extrabold text-sm text-[#123b26] font-mono block">
                          {req.id}
                        </span>
                        <span className="text-[11px] text-[#9aa19d]">
                          {formatDate(req.createdAt)}
                        </span>
                      </td>

                      {/* Customer & Area */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-sm text-[#191c1a] block">
                          {req.address.fullName}
                        </span>
                        <span className="text-[#525955] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#16a34a] shrink-0" />
                          <span>{req.address.area}, {req.address.city}</span>
                        </span>
                        <span className="text-[11px] text-[#717a75] block mt-0.5">
                          Ph: +91 {req.address.phoneNumber}
                        </span>
                      </td>

                      {/* Scheduled Slot */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-semibold text-[#123b26] block">
                          {formatDate(req.scheduledDate || req.address.preferredDate)}
                        </span>
                        <span className="text-[#717a75]">
                          {req.scheduledTimeSlot || req.address.timeSlot}
                        </span>
                      </td>

                      {/* Materials */}
                      <td className="py-4 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {req.materials.map((m) => (
                            <span
                              key={m.materialId}
                              className="px-2 py-0.5 text-[10px] rounded-md bg-[#f1f3f1] font-medium text-[#282c2a]"
                            >
                              {m.materialName} ({m.actualQuantity != null ? `${m.actualQuantity} ${m.unit} weighed` : `${m.quantity} ${m.unit}`})
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Value */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-black text-sm text-[#123b26] block">
                          {formatINR(req.actualTotal != null ? req.actualTotal : req.estimatedTotal)}
                        </span>
                        <span className="text-[10px] text-[#717a75]">
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
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#16a34a] hover:bg-[#15803d] text-white shadow-2xs active:scale-[0.98] transition-all"
                            >
                              Claim Lead
                            </button>
                          )}

                          {req.status === 'dealer_assigned' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'schedule')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs active:scale-[0.98] transition-all"
                            >
                              Schedule Pickup
                            </button>
                          )}

                          {req.status === 'scheduled' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'on_the_way')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs active:scale-[0.98] transition-all"
                            >
                              Start Route
                            </button>
                          )}

                          {(req.status === 'on_the_way' || req.status === 'in_progress') && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'weigh')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-2xs active:scale-[0.98] transition-all"
                            >
                              Weigh Scrap
                            </button>
                          )}

                          {req.status === 'collected_weighed' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'payment')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-[0.98] transition-all"
                            >
                              Settle Payment
                            </button>
                          )}

                          {req.status === 'payment_completed' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'complete')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs active:scale-[0.98] transition-all"
                            >
                              Complete
                            </button>
                          )}

                          {req.status === 'rescheduled' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'schedule')}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-2xs active:scale-[0.98] transition-all"
                            >
                              Confirm Slot
                            </button>
                          )}

                          {/* Quick Reschedule & Cancel options for in-flight pickups */}
                          {req.status !== 'completed' && req.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req, 'reschedule')}
                              className="px-2 py-1 text-[11px] font-semibold text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Reschedule Pickup"
                            >
                              Reschedule
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedBooking(req)}
                            className="p-1.5 rounded-xl text-[#525955] hover:text-[#191c1a] hover:bg-[#f1f3f1] transition-colors"
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
          <div className="lg:hidden divide-y divide-[#f1f3f1]">
            {filteredBookings.map((req) => {
              const statusInfo = getStatusDetails(req.status);
              return (
                <div key={req.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-extrabold text-sm text-[#123b26]">
                        {req.id}
                      </span>
                      <h4 className="font-bold text-base text-[#191c1a] mt-0.5">
                        {req.address.fullName}
                      </h4>
                      <p className="text-xs text-[#525955]">
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

                  <div className="text-xs text-[#525955] space-y-1">
                    <p>
                      <strong>Slot:</strong>{' '}
                      {formatDate(req.scheduledDate || req.address.preferredDate)} •{' '}
                      {req.scheduledTimeSlot || req.address.timeSlot}
                    </p>
                    <p>
                      <strong>Materials:</strong>{' '}
                      {req.materials.map((m) => `${m.materialName} (${m.actualQuantity != null ? `${m.actualQuantity} ${m.unit} weighed` : `${m.quantity} ${m.unit}`})`).join(', ')}
                    </p>
                    <p className="font-black text-sm text-[#123b26] pt-1">
                      Payout:{' '}
                      {formatINR(req.actualTotal != null ? req.actualTotal : req.estimatedTotal)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between border-t border-[#f1f3f1] gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedBooking(req)}
                      className="text-xs font-bold text-[#16a34a] hover:underline"
                    >
                      Order Sheet &rarr;
                    </button>

                    <div className="flex items-center gap-2">
                      {req.status === 'requested' && (
                        <button
                          type="button"
                          onClick={() => openActionModal(req, 'claim')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#16a34a] text-white"
                        >
                          Claim
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
          title={`Dealer Order Sheet: ${selectedBooking.id}`}
          subtitle={`Customer: ${selectedBooking.address.fullName}`}
          maxWidth="2xl"
        >
          <div className="space-y-6 text-xs sm:text-sm">
            {/* Quick Actions Stepper Bar inside modal */}
            <div className="p-4 rounded-2xl bg-[#f8faf9] border border-[#e2e4e1] flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#717a75] block">
                  Next Order Transition
                </span>
                <span className="text-xs text-[#123b26] font-semibold">
                  Current Status: {getStatusDetails(selectedBooking.status).label}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedBooking.status === 'requested' && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'claim')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#16a34a] text-white shadow-2xs"
                  >
                    Claim Lead
                  </button>
                )}

                {selectedBooking.status === 'dealer_assigned' && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'schedule')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-2xs"
                  >
                    Confirm Schedule
                  </button>
                )}

                {selectedBooking.status === 'scheduled' && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'on_the_way')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 text-white shadow-2xs"
                  >
                    Dispatch / On the Way
                  </button>
                )}

                {(selectedBooking.status === 'on_the_way' ||
                  selectedBooking.status === 'in_progress') && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'weigh')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-600 text-white shadow-2xs"
                  >
                    Scale Weighing
                  </button>
                )}

                {selectedBooking.status === 'collected_weighed' && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'payment')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-2xs"
                  >
                    Record Payment
                  </button>
                )}

                {selectedBooking.status === 'payment_completed' && (
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedBooking, 'complete')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 text-white shadow-2xs"
                  >
                    Finish Order
                  </button>
                )}

                {selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && (
                  <>
                    <button
                      type="button"
                      onClick={() => openActionModal(selectedBooking, 'reschedule')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200"
                    >
                      Reschedule
                    </button>

                    <button
                      type="button"
                      onClick={() => openActionModal(selectedBooking, 'cancel')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200"
                    >
                      Cancel Order
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Embedded 7-Step Pickup Tracker Timeline */}
            <PickupTrackerTimeline booking={selectedBooking} compact={false} />

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#123b26] text-white hover:bg-[#1a5336] transition-colors"
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
            fetchBookings();
          }}
          dealerId={currentDealer?.id || DEMO_DEALER.id}
          isConfigured={isConfigured}
          user={user}
        />
      )}
    </div>
  );
};

