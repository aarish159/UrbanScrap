import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Phone,
  Mail,
  MapPin,
  Truck,
  Eye,
  Database,
  Sparkles,
  RefreshCw,
  Plus,
  Filter,
  X,
} from 'lucide-react';
import type { DealerApplication } from '../types';
import {
  getDealerApplications,
  updateDealerApplicationStatus,
  saveDealerApplication,
  subscribeToDealerChanges,
} from '../utils/storage';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useScrollAnimation } from '../utils/useScrollAnimation';

export const AdminDealersPage: React.FC = () => {
  const { user, isConfigured } = useAuth();
  const { showToast } = useToast();
  useScrollAnimation();

  const [applications, setApplications] = useState<DealerApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');

  // Modal states
  const [selectedApp, setSelectedApp] = useState<DealerApplication | null>(null);
  const [rejectModalApp, setRejectModalApp] = useState<DealerApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Load applications from Supabase if live, or local storage
  const loadApplications = useCallback(async () => {
    setLoading(true);

    if (isConfigured && isSupabaseConfigured() && user) {
      try {
        const { data: dealersData, error } = await supabase
          .from('dealers')
          .select(`
            id,
            user_id,
            business_name,
            phone,
            service_area,
            vehicle_type,
            rating,
            is_verified,
            created_at,
            updated_at
          `)
          .order('created_at', { ascending: false });

        if (!error && dealersData) {
          // Map to DealerApplication
          const mapped: DealerApplication[] = dealersData.map((d) => ({
            id: d.id,
            userId: d.user_id,
            businessName: d.business_name,
            applicantName: 'Authorized Partner',
            email: 'partner@urbanscrap.in',
            phone: d.phone,
            serviceArea: d.service_area,
            vehicleType: d.vehicle_type,
            rating: Number(d.rating),
            isVerified: d.is_verified,
            status: d.is_verified ? 'verified' : 'pending',
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));

          setApplications(mapped);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Supabase fetch failed, falling back to local dealer storage:', err);
      }
    }

    // Local storage fallback / demo data
    setApplications(getDealerApplications());
    setLoading(false);
  }, [isConfigured, user]);

  useEffect(() => {
    loadApplications();
    const unsubscribe = subscribeToDealerChanges(loadApplications);
    return () => unsubscribe();
  }, [loadApplications]);

  // Compute metrics
  const metrics = useMemo(() => {
    const total = applications.length;
    const pending = applications.filter((a) => a.status === 'pending').length;
    const verified = applications.filter((a) => a.status === 'verified').length;
    const rejected = applications.filter((a) => a.status === 'rejected').length;
    return { total, pending, verified, rejected };
  }, [applications]);

  // Filtered applications
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchStatus = statusFilter === 'all' || app.status === statusFilter;
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        q === '' ||
        app.businessName.toLowerCase().includes(q) ||
        app.applicantName.toLowerCase().includes(q) ||
        app.phone.includes(q) ||
        app.serviceArea.toLowerCase().includes(q) ||
        app.email.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [applications, statusFilter, searchTerm]);

  // Approve Dealer Application
  const handleApprove = async (app: DealerApplication) => {
    setIsProcessing(true);
    try {
      if (isConfigured && isSupabaseConfigured() && user) {
        // 1. Update public.dealers set is_verified = true
        const { error: dealerErr } = await supabase
          .from('dealers')
          .update({
            is_verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', app.id);

        if (dealerErr) {
          showToast('Approval Failed', dealerErr.message, 'error');
          setIsProcessing(false);
          return;
        }

        // 2. If dealer has a linked user_id, promote user's profile role to 'dealer'
        if (app.userId) {
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({ role: 'dealer' })
            .eq('id', app.userId);

          if (profileErr) {
            console.warn('Profile role escalation note:', profileErr.message);
          }
        }
      }

      // Update local storage
      updateDealerApplicationStatus(app.id, 'verified');
      showToast(
        'Dealer Approved & Activated!',
        `${app.businessName} is now a verified partner. Dealer Dashboard access is unlocked.`,
        'success'
      );
      await loadApplications();
      if (selectedApp && selectedApp.id === app.id) {
        setSelectedApp({ ...selectedApp, status: 'verified', isVerified: true });
      }
    } catch {
      showToast('Error', 'An error occurred while approving application.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reject Dealer Application
  const handleConfirmReject = async () => {
    if (!rejectModalApp) return;

    setIsProcessing(true);
    try {
      if (isConfigured && isSupabaseConfigured() && user) {
        // Update public.dealers set is_verified = false
        const { error: dealerErr } = await supabase
          .from('dealers')
          .update({
            is_verified: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rejectModalApp.id);

        if (dealerErr) {
          showToast('Rejection Failed', dealerErr.message, 'error');
          setIsProcessing(false);
          return;
        }

        // Keep or reset user profile role to customer
        if (rejectModalApp.userId) {
          await supabase
            .from('profiles')
            .update({ role: 'customer' })
            .eq('id', rejectModalApp.userId);
        }
      }

      // Update local storage
      updateDealerApplicationStatus(
        rejectModalApp.id,
        'rejected',
        rejectionReason.trim() || 'Application did not meet service area requirements.'
      );

      showToast(
        'Application Rejected',
        `${rejectModalApp.businessName} has been rejected.`,
        'info'
      );

      setRejectModalApp(null);
      setRejectionReason('');
      await loadApplications();
      if (selectedApp && selectedApp.id === rejectModalApp.id) {
        setSelectedApp({
          ...selectedApp,
          status: 'rejected',
          isVerified: false,
          rejectionReason: rejectionReason.trim(),
        });
      }
    } catch {
      showToast('Error', 'An error occurred while rejecting application.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick helper to simulate a new applicant for instant testing
  const handleSimulateNewApplicant = () => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const mockApplicant: DealerApplication = {
      id: `dealer-app-${Date.now()}`,
      businessName: `Bengaluru Eco Scrappers #${randomNum}`,
      applicantName: `Vikram Shenoy`,
      email: `vikram.${randomNum}@ecoscrap.in`,
      phone: `98440${randomNum}12`,
      serviceArea: 'Whitefield & Marathahalli, Bengaluru',
      vehicleType: 'Electric Three-Wheeler (EV Loader)',
      rating: 4.8,
      isVerified: false,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveDealerApplication(mockApplicant);
    showToast(
      'Test Application Created',
      `Simulated pending dealer: ${mockApplicant.businessName}`,
      'success'
    );
    loadApplications();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e6e8e5] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Administration Portal</span>
            </div>

            {isConfigured && isSupabaseConfigured() ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-xs font-bold">
                <Database className="w-3 h-3 text-blue-700" />
                <span>Supabase Live</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                <Sparkles className="w-3 h-3 text-amber-700" />
                <span>Demo Sandbox</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#123b26] tracking-tight">
            Dealer Partner Verification & Applications
          </h1>
          <p className="text-xs sm:text-sm text-[#525955] mt-1 max-w-2xl">
            Review incoming scrap merchant applications, verify business credentials, and grant or revoke access to the Urban Scrap Dealer Dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={handleSimulateNewApplicant}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-white text-[#123b26] border border-[#d1d5db] hover:bg-[#f1f3f1] shadow-2xs transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Simulate New Application</span>
          </button>
          <button
            type="button"
            onClick={() => loadApplications()}
            className="p-2.5 rounded-xl text-[#525955] hover:text-[#123b26] hover:bg-[#f1f3f1] border border-[#d1d5db] transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#e6e8e5] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#717a75] uppercase tracking-wider">
              Total Applicants
            </span>
            <Building2 className="w-5 h-5 text-[#123b26]" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#123b26]">
            {metrics.total}
          </div>
          <div className="text-[11px] text-[#717a75] mt-0.5">Commercial scrap merchants</div>
        </div>

        {/* Pending */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Pending Review
            </span>
            <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-900">
            {metrics.pending}
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5">Requires admin approval</div>
        </div>

        {/* Verified */}
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Verified Partners
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-900">
            {metrics.verified}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Active dashboard access</div>
        </div>

        {/* Rejected */}
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/70 border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
              Rejected
            </span>
            <XCircle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-rose-900">
            {metrics.rejected}
          </div>
          <div className="text-[11px] text-rose-700 mt-0.5">Access denied</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#f1f3f1] text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-white text-[#123b26] shadow-2xs'
                : 'text-[#525955] hover:text-[#191c1a]'
            }`}
          >
            All ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'bg-white text-amber-900 shadow-2xs'
                : 'text-[#525955] hover:text-[#191c1a]'
            }`}
          >
            Pending Review ({metrics.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('verified')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              statusFilter === 'verified'
                ? 'bg-white text-emerald-900 shadow-2xs'
                : 'text-[#525955] hover:text-[#191c1a]'
            }`}
          >
            Verified ({metrics.verified})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              statusFilter === 'rejected'
                ? 'bg-white text-rose-900 shadow-2xs'
                : 'text-[#525955] hover:text-[#191c1a]'
            }`}
          >
            Rejected ({metrics.rejected})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
          <input
            type="text"
            placeholder="Search business, phone, area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
          />
        </div>
      </div>

      {/* Applications List Table */}
      {filteredApps.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#e6e8e5] space-y-3">
          <div className="w-12 h-12 rounded-xl bg-gray-50 text-[#717a75] mx-auto flex items-center justify-center">
            <Filter className="w-6 h-6 stroke-[2]" />
          </div>
          <h3 className="font-extrabold text-base text-[#123b26]">No Dealer Applications Found</h3>
          <p className="text-xs text-[#525955] max-w-sm mx-auto">
            {searchTerm
              ? `No applicants matched "${searchTerm}". Try adjusting your search term.`
              : `There are currently no dealer applications matching the selected status.`}
          </p>
          <button
            type="button"
            onClick={handleSimulateNewApplicant}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#123b26] text-white hover:bg-[#1a5336]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Test Application</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e6e8e5] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e6e8e5] bg-[#f8faf9] text-[11px] font-bold text-[#525955] uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Business / Yard Name</th>
                  <th className="py-3.5 px-4">Contact Person</th>
                  <th className="py-3.5 px-4">Operational Area</th>
                  <th className="py-3.5 px-4">Fleet Type</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f1] text-xs">
                {filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-[#fcfdfc] transition-colors">
                    {/* Business Name */}
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#123b26] text-[#4ade80] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {app.businessName[0]}
                        </div>
                        <div>
                          <span className="font-bold text-[#123b26] block text-sm">
                            {app.businessName}
                          </span>
                          <span className="text-[11px] text-[#717a75] font-mono">
                            ID: {app.id.slice(0, 15)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Contact Person */}
                    <td className="py-4 px-4">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-[#191c1a] block">
                          {app.applicantName}
                        </span>
                        <div className="flex items-center gap-1.5 text-[#525955] text-[11px]">
                          <Phone className="w-3 h-3 text-[#717a75]" />
                          <span>+91 {app.phone}</span>
                        </div>
                        {app.email && (
                          <div className="flex items-center gap-1.5 text-[#717a75] text-[11px]">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[140px]">{app.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Operational Area */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-[#191c1a]">
                        <MapPin className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />
                        <span className="font-medium">{app.serviceArea}</span>
                      </div>
                    </td>

                    {/* Fleet Type */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-[#525955]">
                        <Truck className="w-3.5 h-3.5 text-[#717a75] shrink-0" />
                        <span>{app.vehicleType}</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4 text-center">
                      {app.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          <span>Pending Review</span>
                        </span>
                      ) : app.status === 'verified' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Verified Partner</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-700" />
                          <span>Rejected</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedApp(app)}
                          className="p-1.5 rounded-lg text-[#525955] hover:text-[#123b26] hover:bg-[#f1f3f1] transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {app.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleApprove(app)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#16a34a] hover:bg-[#15803d] text-white shadow-2xs transition-all active:scale-[0.98] disabled:opacity-50"
                              title="Approve and Grant Dealer Access"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => {
                                setRejectModalApp(app);
                                setRejectionReason('');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition-all active:scale-[0.98] disabled:opacity-50"
                              title="Reject Application"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        ) : app.status === 'rejected' ? (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleApprove(app)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white text-[#16a34a] border border-[#16a34a] hover:bg-emerald-50 transition-all"
                            title="Re-verify and Approve"
                          >
                            <span>Re-approve</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setRejectModalApp(app);
                              setRejectionReason('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 transition-all"
                            title="Revoke Verification"
                          >
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DETAILS MODAL                                                 */}
      {/* ============================================================== */}
      {selectedApp && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0a2417]/65 backdrop-blur-xs"
            onClick={() => setSelectedApp(null)}
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-[#e6e8e5] animate-in zoom-in-95 space-y-6">
            <div className="flex items-start justify-between border-b border-[#f1f3f1] pb-4">
              <div>
                <span className="text-[11px] font-bold text-[#16a34a] uppercase tracking-wider">
                  Dealer Partner Profile
                </span>
                <h3 className="text-xl font-extrabold text-[#123b26] mt-0.5">
                  {selectedApp.businessName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="p-1.5 rounded-xl text-[#717a75] hover:bg-[#f1f3f1] -mr-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#e5e8e5]">
                <span className="text-[#717a75] block font-semibold mb-1">Status</span>
                {selectedApp.status === 'verified' ? (
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified & Active
                  </span>
                ) : selectedApp.status === 'pending' ? (
                  <span className="font-bold text-amber-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Pending Admin Review
                  </span>
                ) : (
                  <span className="font-bold text-rose-700 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Application Rejected
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#e5e8e5]">
                <span className="text-[#717a75] block font-semibold mb-1">Fleet Type</span>
                <span className="font-bold text-[#123b26]">{selectedApp.vehicleType}</span>
              </div>

              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#e5e8e5]">
                <span className="text-[#717a75] block font-semibold mb-1">Contact Person</span>
                <span className="font-bold text-[#123b26]">{selectedApp.applicantName}</span>
              </div>

              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#e5e8e5]">
                <span className="text-[#717a75] block font-semibold mb-1">Phone Number</span>
                <span className="font-bold text-[#123b26]">+91 {selectedApp.phone}</span>
              </div>

              <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#e5e8e5] col-span-2">
                <span className="text-[#717a75] block font-semibold mb-1">Operational Area</span>
                <span className="font-bold text-[#123b26]">{selectedApp.serviceArea}</span>
              </div>

              {selectedApp.rejectionReason && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 col-span-2">
                  <span className="font-bold block mb-1">Rejection Reason:</span>
                  <span>{selectedApp.rejectionReason}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#f1f3f1]">
              {selectedApp.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const app = selectedApp;
                      setSelectedApp(null);
                      setRejectModalApp(app);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200"
                  >
                    Reject Application
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleApprove(selectedApp);
                      setSelectedApp(null);
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md"
                  >
                    Approve Partner
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#123b26] text-white"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* REJECTION CONFIRMATION MODAL                                   */}
      {/* ============================================================== */}
      {rejectModalApp && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0a2417]/65 backdrop-blur-xs"
            onClick={() => setRejectModalApp(null)}
          />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-[#e6e8e5] animate-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-7 h-7 stroke-[2.2]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-[#123b26]">
                Reject Dealer Application?
              </h3>
              <p className="text-xs text-[#525955] leading-relaxed">
                You are about to reject the application for{' '}
                <strong className="text-[#191c1a]">{rejectModalApp.businessName}</strong>. The applicant will not receive Dealer Dashboard access.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#191c1a] mb-1">
                Reason for Rejection (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Incomplete GST credentials or outside operational city boundaries."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 text-xs rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#525955] hover:bg-[#f1f3f1]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmReject}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md disabled:opacity-50"
              >
                {isProcessing ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
