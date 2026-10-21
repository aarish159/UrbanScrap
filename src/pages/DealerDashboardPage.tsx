import React, { useState, useEffect, useMemo } from 'react';
import {
  Store,
  Search,
  MapPin,
  AlertCircle,
  Truck,
  Eye,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { Booking, BookingStatus } from '../types';
import { DEMO_DEALER } from '../data/mockData';
import {
  getBookings,
  updateBookingStatus,
  subscribeToBookingChanges,
} from '../utils/storage';
import { formatINR, formatDate, getStatusDetails } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

export const DealerDashboardPage: React.FC = () => {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Subscribe to bookings storage
  useEffect(() => {
    const refresh = () => {
      setBookings(getBookings());
    };
    refresh();
    const unsubscribe = subscribeToBookingChanges(refresh);
    return () => unsubscribe();
  }, []);

  // Compute metrics
  const metrics = useMemo(() => {
    const newRequests = bookings.filter((b) => b.status === 'requested').length;
    const scheduled = bookings.filter(
      (b) => b.status === 'dealer_assigned' || b.status === 'in_progress'
    ).length;
    const completed = bookings.filter((b) => b.status === 'completed').length;
    const earnings = bookings
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + b.estimatedTotal, 0);

    return {
      newRequests,
      scheduled,
      completed,
      earnings,
    };
  }, [bookings]);

  // Filtered requests list
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      const q = searchTerm.toLowerCase();
      const matchSearch =
        b.id.toLowerCase().includes(q) ||
        b.address.fullName.toLowerCase().includes(q) ||
        b.address.area.toLowerCase().includes(q) ||
        b.address.city.toLowerCase().includes(q) ||
        b.materials.some((m) => m.materialName.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [bookings, statusFilter, searchTerm]);

  // Status Change Handler
  const handleStatusChange = (bookingId: string, newStatus: BookingStatus) => {
    const updated = updateBookingStatus(
      bookingId,
      newStatus,
      `Status updated to ${newStatus.replace('_', ' ')} by dealer Rajesh Kumar.`
    );
    if (updated) {
      showToast(
        'Status Updated',
        `Pickup ${bookingId} is now ${newStatus.replace('_', ' ')}.`,
        'success'
      );
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking(updated);
      }
    }
  };

  const statusOptions: { value: BookingStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Requests' },
    { value: 'requested', label: 'New Requests' },
    { value: 'dealer_assigned', label: 'Assigned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>Dealer Demo Dashboard</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#143e29] tracking-tight">
            Scrap Dealer Operations Portal
          </h1>
          <p className="text-sm text-[#555c58] mt-1">
            Simulate how verified scrap collectors view pickup leads, update route progress, and record weighing transactions.
          </p>
        </div>

        {/* Prototype alert indicator */}
        <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2 self-start md:self-center">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Mock environment • No real accounts connected</span>
        </div>
      </div>

      {/* Mock Dealer Profile Card */}
      <div className="bg-gradient-to-r from-[#143e29] to-[#1c5539] rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#22c55e] text-[#143e29] flex items-center justify-center font-bold shadow-inner shrink-0">
            <Store className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white">{DEMO_DEALER.name}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#86efac] text-[#143e29]">
                Demo Partner
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-300 text-stone-900">
                ⭐ {DEMO_DEALER.rating} / 5.0
              </span>
            </div>
            <p className="text-xs text-[#cad5ce] mt-0.5">
              {DEMO_DEALER.businessName} • Operational Zone: HSR & Koramangala Ward, Bengaluru
            </p>
            <p className="text-xs text-[#a7b5ad] mt-1 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#86efac]" />
              <span>Assigned Fleet: {DEMO_DEALER.vehicleType}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch md:self-auto border-t md:border-t-0 pt-3 md:pt-0 border-[#2b6d4b]">
          <div className="px-3.5 py-2 rounded-xl bg-[#0f2e1e] border border-[#276446] text-xs">
            <span className="text-[#86efac] font-bold block">Certified Equipment</span>
            <span className="text-[#cad5ce]">Digital Platform Scale (150kg)</span>
          </div>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl p-5 border border-[#e8e8e3] shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#717a75]">
            <span>New Requests</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
              Demo
            </span>
          </div>
          <div className="text-3xl font-black text-[#143e29] mt-2">
            {metrics.newRequests}
          </div>
          <span className="text-[11px] text-[#9aa19d] mt-1 block">Awaiting partner acceptance</span>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl p-5 border border-[#e8e8e3] shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#717a75]">
            <span>Scheduled Pickups</span>
            <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
              Demo
            </span>
          </div>
          <div className="text-3xl font-black text-[#143e29] mt-2">
            {metrics.scheduled}
          </div>
          <span className="text-[11px] text-[#9aa19d] mt-1 block">Assigned / In progress</span>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl p-5 border border-[#e8e8e3] shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#717a75]">
            <span>Completed Pickups</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Demo
            </span>
          </div>
          <div className="text-3xl font-black text-[#16a34a] mt-2">
            {metrics.completed}
          </div>
          <span className="text-[11px] text-[#9aa19d] mt-1 block">Collected & recycled</span>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl p-5 border border-[#e8e8e3] shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#717a75]">
            <span>Indicative Volume Value</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
              Demo
            </span>
          </div>
          <div className="text-3xl font-black text-[#143e29] mt-2">
            {formatINR(metrics.earnings)}
          </div>
          <span className="text-[11px] text-[#9aa19d] mt-1 block">Settled payouts total</span>
        </div>
      </div>

      {/* Requests Management: Search & Status Filters */}
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
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a] text-[#191c1a]"
            />
          </div>

          <div className="text-xs text-[#717a75]">
            Showing <strong className="text-[#143e29]">{filteredBookings.length}</strong> pickup requests
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {statusOptions.map((opt) => {
            const isSelected = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#143e29] text-white shadow-sm'
                    : 'bg-white text-[#555c58] border border-[#d1d5db] hover:border-[#143e29]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Requests Table / Cards */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#e8e8e3] space-y-3">
          <AlertCircle className="w-10 h-10 text-[#9aa19d] mx-auto" />
          <h3 className="font-bold text-base text-[#143e29]">No requests match your filters</h3>
          <p className="text-xs text-[#717a75] max-w-sm mx-auto">
            Try resetting your search query or selecting "All Requests" to view existing customer bookings.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#f1f3f1] text-[#191c1a] hover:bg-[#e2e4e1]"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e8e8e3] shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8faf9] border-b border-[#e8e8e3] text-[11px] font-bold uppercase tracking-wider text-[#717a75]">
                  <th className="py-3.5 px-6">ID & Date</th>
                  <th className="py-3.5 px-4">Customer & Area</th>
                  <th className="py-3.5 px-4">Scheduled Slot</th>
                  <th className="py-3.5 px-4">Materials Summary</th>
                  <th className="py-3.5 px-4">Est. Value</th>
                  <th className="py-3.5 px-4">Current Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f1] text-xs">
                {filteredBookings.map((req) => {
                  const statusInfo = getStatusDetails(req.status);
                  return (
                    <tr key={req.id} className="hover:bg-[#fbfbf9] transition-colors">
                      {/* ID */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="font-extrabold text-sm text-[#143e29] font-mono block">
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
                        <span className="text-[#555c58] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#16a34a]" />
                          <span>{req.address.area}, {req.address.city}</span>
                        </span>
                      </td>

                      {/* Scheduled Slot */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-semibold text-[#143e29] block">
                          {formatDate(req.address.preferredDate)}
                        </span>
                        <span className="text-[#717a75]">{req.address.timeSlot}</span>
                      </td>

                      {/* Materials */}
                      <td className="py-4 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {req.materials.map((m) => (
                            <span
                              key={m.materialId}
                              className="px-2 py-0.5 text-[10px] rounded bg-[#f1f3f1] font-medium text-[#282c2a]"
                            >
                              {m.materialName} ({m.quantity}{m.unit})
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Value */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-black text-sm text-[#143e29]">
                          {formatINR(req.estimatedTotal)}
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

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Quick status actions based on current status */}
                          {req.status === 'requested' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(req.id, 'dealer_assigned')}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#16a34a] hover:bg-[#15803d] text-white"
                            >
                              Accept
                            </button>
                          )}
                          {req.status === 'dealer_assigned' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(req.id, 'in_progress')}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              Start Route
                            </button>
                          )}
                          {req.status === 'in_progress' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(req.id, 'completed')}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              Complete
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedBooking(req)}
                            className="p-1.5 rounded-lg text-[#555c58] hover:text-[#191c1a] hover:bg-[#f1f3f1]"
                            title="View Full Address & Notes"
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
                      <span className="font-mono font-extrabold text-sm text-[#143e29]">
                        {req.id}
                      </span>
                      <h4 className="font-bold text-base text-[#191c1a] mt-0.5">
                        {req.address.fullName}
                      </h4>
                      <p className="text-xs text-[#555c58]">
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

                  <div className="text-xs text-[#555c58] space-y-1">
                    <p>
                      <strong>Slot:</strong> {formatDate(req.address.preferredDate)} • {req.address.timeSlot}
                    </p>
                    <p>
                      <strong>Materials:</strong>{' '}
                      {req.materials.map((m) => `${m.materialName} (${m.quantity} ${m.unit})`).join(', ')}
                    </p>
                    <p className="font-black text-sm text-[#143e29] pt-1">
                      Estimated Value: {formatINR(req.estimatedTotal)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between border-t border-[#f1f3f1]">
                    <button
                      type="button"
                      onClick={() => setSelectedBooking(req)}
                      className="text-xs font-bold text-[#16a34a] hover:underline"
                    >
                      View Details & Notes &rarr;
                    </button>

                    <div className="flex items-center gap-2">
                      {req.status === 'requested' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(req.id, 'dealer_assigned')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#16a34a] text-white"
                        >
                          Accept
                        </button>
                      )}
                      {req.status === 'dealer_assigned' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(req.id, 'in_progress')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white"
                        >
                          Start Route
                        </button>
                      )}
                      {req.status === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(req.id, 'completed')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white"
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

      {/* DETAIL MODAL FOR DEALER INSPECTION */}
      {selectedBooking && (
        <Modal
          isOpen={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          title={`Dealer Order Sheet: ${selectedBooking.id}`}
          subtitle={`Customer: ${selectedBooking.address.fullName}`}
          maxWidth="2xl"
        >
          <div className="space-y-6 text-xs sm:text-sm">
            {/* Status change select in modal */}
            <div className="p-4 rounded-xl bg-[#f8faf9] border border-[#e2e4e1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#717a75] block">
                  Change Pickup Status
                </span>
                <span className="text-xs text-[#555c58]">
                  Updates reflect instantly across customer "My Bookings"
                </span>
              </div>

              <select
                value={selectedBooking.status}
                onChange={(e) =>
                  handleStatusChange(selectedBooking.id, e.target.value as BookingStatus)
                }
                className="px-3 py-2 rounded-xl text-xs font-bold border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              >
                <option value="requested">Requested (New)</option>
                <option value="dealer_assigned">Dealer Assigned</option>
                <option value="in_progress">In Progress (Out for collection)</option>
                <option value="completed">Completed (Weighed & Paid)</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Customer Details & Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white border border-[#e8e8e3] space-y-1">
                <span className="font-bold text-[#143e29] block mb-1">Customer & Contact</span>
                <p className="font-bold text-base text-[#191c1a]">
                  {selectedBooking.address.fullName}
                </p>
                <p className="font-semibold text-[#16a34a]">
                  Phone: +91 {selectedBooking.address.phoneNumber}
                </p>
                {selectedBooking.address.email && (
                  <p className="text-[#717a75]">Email: {selectedBooking.address.email}</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#e8e8e3] space-y-1">
                <span className="font-bold text-[#143e29] block mb-1">Doorstep Location</span>
                <p>{selectedBooking.address.streetAddress}</p>
                <p>{selectedBooking.address.area}, {selectedBooking.address.city}</p>
                <p className="font-mono font-semibold">PIN: {selectedBooking.address.pincode}</p>
              </div>
            </div>

            {/* Special Instructions & Notes */}
            {selectedBooking.address.notes && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <span className="font-bold block text-xs">Customer Pickup Notes:</span>
                <p className="text-xs mt-0.5 italic">"{selectedBooking.address.notes}"</p>
              </div>
            )}

            {/* Materials Manifest */}
            <div className="space-y-2">
              <span className="font-bold text-[#143e29] block">
                Manifest Checklist ({selectedBooking.materials.length} categories)
              </span>
              <div className="border border-[#e8e8e3] rounded-xl overflow-hidden divide-y divide-[#f1f3f1]">
                {selectedBooking.materials.map((m) => (
                  <div key={m.materialId} className="p-3 flex items-center justify-between bg-white text-xs">
                    <div>
                      <span className="font-bold text-[#143e29] block">{m.materialName}</span>
                      <span className="text-[#717a75]">
                        Estimated: {m.quantity} {m.unit} @ {formatINR(m.ratePerUnit)}/{m.unit}
                      </span>
                    </div>
                    <span className="font-extrabold text-[#143e29]">
                      {formatINR(m.estimatedSubtotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-between">
                <span className="font-bold text-[#16a34a] uppercase tracking-wider text-xs">
                  Estimated Total Payout
                </span>
                <span className="text-lg font-black text-[#143e29]">
                  {formatINR(selectedBooking.estimatedTotal)}
                </span>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="px-6 py-2 rounded-xl text-xs font-bold bg-[#143e29] text-white hover:bg-[#1a5336]"
              >
                Close Order Sheet
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
