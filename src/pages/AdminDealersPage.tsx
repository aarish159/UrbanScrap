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
  Eye,
  Database,
  Sparkles,
  RefreshCw,
  Plus,
  Filter,
  X,
  ExternalLink,
  FileText,
  Copy,
  Check,
  AlertTriangle,
  History,
  Calendar,
} from 'lucide-react';
import type { DealerApplication, DealerReview } from '../types';
import {
  getDealerApplications,
  updateDealerApplicationStatus,
  saveDealerApplication,
  subscribeToDealerChanges,
  getDealerReviews,
  isValidUuid,
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showDemoRecords, setShowDemoRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');

  // Modal & review states
  const [selectedApp, setSelectedApp] = useState<DealerApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedGstin, setCopiedGstin] = useState(false);
  const [auditReviews, setAuditReviews] = useState<DealerReview[]>([]);

  // Load applications from Supabase if live, without silently falling back to mockData
  const loadApplications = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const isLive = isConfigured && isSupabaseConfigured() && !!user;

    if (isLive) {
      try {
        const { data: dealersData, error } = await supabase
          .from('dealers')
          .select(`
            id,
            user_id,
            business_name,
            legal_business_name,
            gstin,
            business_address,
            state,
            gst_certificate_url,
            verification_status,
            rejection_reason,
            review_notes,
            reviewed_by,
            reviewed_at,
            submitted_at,
            phone,
            service_area,
            vehicle_type,
            rating,
            is_verified,
            created_at,
            updated_at
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase dealers fetch error:', error);
          setLoadError(error.message);
          // Strict Production requirement: Do NOT silently use mockData as fallback
          setApplications([]);
          setLoading(false);
          return;
        }

        const mapped: DealerApplication[] = (dealersData || []).map((d) => {
          const rawStatus = d.verification_status as string | undefined;
          const status: 'pending' | 'verified' | 'rejected' =
            rawStatus === 'approved' || (d.is_verified && !rawStatus)
              ? 'verified'
              : rawStatus === 'rejected'
              ? 'rejected'
              : 'pending';

          return {
            id: d.id,
            userId: d.user_id,
            businessName: d.business_name,
            legalBusinessName: d.legal_business_name || undefined,
            gstin: d.gstin || undefined,
            businessAddress: d.business_address || undefined,
            state: d.state || undefined,
            gstCertificateUrl: d.gst_certificate_url || undefined,
            applicantName: d.business_name || 'Dealer Partner',
            email: 'partner@urbanscrap.in',
            phone: d.phone,
            serviceArea: d.service_area,
            vehicleType: d.vehicle_type,
            rating: Number(d.rating || 4.8),
            isVerified: d.is_verified,
            status,
            rejectionReason: d.rejection_reason || undefined,
            reviewNotes: d.review_notes || undefined,
            reviewedBy: d.reviewed_by || undefined,
            reviewedAt: d.reviewed_at || undefined,
            submittedAt: d.submitted_at || d.created_at,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
            isDemo: false,
          };
        });

        if (showDemoRecords) {
          const demoRows = getDealerApplications().map((app) => ({
            ...app,
            isDemo: true,
          }));
          setApplications([...mapped, ...demoRows]);
        } else {
          setApplications(mapped);
        }
        setLoading(false);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Database query exception.';
        console.error('Supabase fetch exception:', err);
        setLoadError(msg);
        setApplications([]);
        setLoading(false);
        return;
      }
    }

    // Local / Offline demo sandbox mode
    const demoRows = getDealerApplications().map((app) => ({
      ...app,
      isDemo: true,
    }));
    setApplications(demoRows);
    setLoading(false);
  }, [isConfigured, user, showDemoRecords]);

  useEffect(() => {
    loadApplications();
    const unsubscribe = subscribeToDealerChanges(loadApplications);
    return () => unsubscribe();
  }, [loadApplications]);

  // Load audit history whenever selectedApp changes
  useEffect(() => {
    if (!selectedApp) {
      setAuditReviews([]);
      setReviewNotes('');
      setRejectionReason('');
      setShowRejectInput(false);
      return;
    }

    setReviewNotes(selectedApp.reviewNotes || '');
    setRejectionReason(selectedApp.rejectionReason || '');

    const fetchAudit = async () => {
      const isRealDbDealer =
        isConfigured &&
        isSupabaseConfigured() &&
        !!user &&
        isValidUuid(selectedApp.id) &&
        !selectedApp.isDemo;

      if (isRealDbDealer) {
        try {
          const { data } = await supabase
            .from('dealer_reviews')
            .select('*')
            .eq('dealer_id', selectedApp.id)
            .order('created_at', { ascending: false });

          if (data && data.length > 0) {
            setAuditReviews(
              data.map((r) => ({
                id: r.id,
                dealerId: r.dealer_id,
                adminId: r.admin_id,
                action: r.action,
                rejectionReason: r.rejection_reason,
                notes: r.notes,
                createdAt: r.created_at,
              }))
            );
            return;
          }
        } catch {
          // ignore error, fall back to storage
        }
      }

      setAuditReviews(getDealerReviews(selectedApp.id));
    };

    fetchAudit();
  }, [selectedApp, isConfigured, user]);

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
        (app.legalBusinessName && app.legalBusinessName.toLowerCase().includes(q)) ||
        (app.gstin && app.gstin.toLowerCase().includes(q)) ||
        app.applicantName.toLowerCase().includes(q) ||
        app.phone.includes(q) ||
        app.serviceArea.toLowerCase().includes(q) ||
        app.email.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [applications, statusFilter, searchTerm]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedGstin(true);
    showToast('Copied', `GSTIN ${text} copied to clipboard`, 'info');
    setTimeout(() => setCopiedGstin(false), 2000);
  };

  // Approve Dealer Application
  const handleApprove = async (app: DealerApplication) => {
    setIsProcessing(true);
    const now = new Date().toISOString();
    const adminNotes = reviewNotes.trim() || 'Approved after manual verification on official GST portal.';
    const isRealDbDealer =
      isConfigured &&
      isSupabaseConfigured() &&
      !!user &&
      isValidUuid(app.id) &&
      !app.isDemo;

    try {
      if (isRealDbDealer) {
        // 1. Update public.dealers set is_verified = true, verification_status = 'approved'
        const { error: dealerErr } = await supabase
          .from('dealers')
          .update({
            is_verified: true,
            verification_status: 'approved',
            rejection_reason: null,
            review_notes: adminNotes,
            reviewed_by: user.id,
            reviewed_at: now,
            updated_at: now,
          })
          .eq('id', app.id);

        if (dealerErr) {
          showToast('Approval Failed', dealerErr.message, 'error');
          setIsProcessing(false);
          return;
        }

        // 2. Promote user's profile role to 'dealer'
        if (app.userId && isValidUuid(app.userId)) {
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({ role: 'dealer' })
            .eq('id', app.userId);

          if (profileErr) {
            console.warn('Profile role escalation note:', profileErr.message);
          }
        }

        // 3. Log to dealer_reviews audit history
        await supabase.from('dealer_reviews').insert({
          dealer_id: app.id,
          admin_id: user.id,
          action: 'approved',
          rejection_reason: null,
          notes: adminNotes,
          created_at: now,
        });
      }

      // Update local storage (updateDealerApplicationStatus automatically saves dealer review audit record)
      updateDealerApplicationStatus(app.id, 'approved', {
        reviewNotes: adminNotes,
        adminId: user?.id || 'admin-root',
      });

      if (isRealDbDealer) {
        showToast(
          'Dealer Approved & Activated!',
          `${app.businessName} (GST: ${app.gstin || 'N/A'}) is now an authorized dealer partner in Supabase.`,
          'success'
        );
      } else {
        showToast(
          'Dealer Approved (Demo Sandbox)',
          `${app.businessName} was updated locally. Database actions are skipped for demo records without UUIDs.`,
          'info'
        );
      }

      await loadApplications();
      setSelectedApp(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while approving application.';
      showToast('Error', msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reject Dealer Application
  const handleConfirmReject = async (app: DealerApplication) => {
    const reason = rejectionReason.trim();
    if (!reason) {
      showToast('Rejection Reason Required', 'Please provide a clear reason explaining why this application was rejected.', 'error');
      return;
    }

    setIsProcessing(true);
    const now = new Date().toISOString();
    const adminNotes = reviewNotes.trim() || undefined;
    const isRealDbDealer =
      isConfigured &&
      isSupabaseConfigured() &&
      !!user &&
      isValidUuid(app.id) &&
      !app.isDemo;

    try {
      if (isRealDbDealer) {
        // 1. Update public.dealers set is_verified = false, verification_status = 'rejected'
        const { error: dealerErr } = await supabase
          .from('dealers')
          .update({
            is_verified: false,
            verification_status: 'rejected',
            rejection_reason: reason,
            review_notes: adminNotes || null,
            reviewed_by: user.id,
            reviewed_at: now,
            updated_at: now,
          })
          .eq('id', app.id);

        if (dealerErr) {
          showToast('Rejection Failed', dealerErr.message, 'error');
          setIsProcessing(false);
          return;
        }

        // 2. Keep/reset user profile role to customer
        if (app.userId && isValidUuid(app.userId)) {
          await supabase
            .from('profiles')
            .update({ role: 'customer' })
            .eq('id', app.userId);
        }

        // 3. Log to dealer_reviews audit history
        await supabase.from('dealer_reviews').insert({
          dealer_id: app.id,
          admin_id: user.id,
          action: 'rejected',
          rejection_reason: reason,
          notes: adminNotes || null,
          created_at: now,
        });
      }

      // Update local storage (updateDealerApplicationStatus automatically saves dealer review audit record)
      updateDealerApplicationStatus(app.id, 'rejected', {
        rejectionReason: reason,
        reviewNotes: adminNotes,
        adminId: user?.id || 'admin-root',
      });

      if (isRealDbDealer) {
        showToast(
          'Application Rejected',
          `${app.businessName} has been rejected in Supabase. The dealer will see your reason and can correct details.`,
          'info'
        );
      } else {
        showToast(
          'Application Rejected (Demo Sandbox)',
          `${app.businessName} was rejected locally in sandbox mode. Database actions are skipped for demo records.`,
          'info'
        );
      }

      await loadApplications();
      setSelectedApp(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while rejecting application.';
      showToast('Error', msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to simulate a new applicant with GST details for instant testing
  const handleSimulateNewApplicant = () => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const mockApplicant: DealerApplication = {
      id: `dealer-app-${Date.now()}`,
      businessName: `Bengaluru Green Metals #${randomNum}`,
      legalBusinessName: `BENGALURU GREEN METALS RECYCLERS PRIVATE LIMITED`,
      gstin: `29ABCDE${randomNum}1Z5`,
      businessAddress: `${randomNum}, 4th Cross, Peenya Industrial Area, Phase II`,
      state: 'Karnataka',
      applicantName: `Vikram Shenoy`,
      email: `vikram.${randomNum}@greenmetals.in`,
      phone: `98440${randomNum}12`,
      serviceArea: 'Peenya & Yeshwanthpur, Bengaluru',
      vehicleType: 'Electric Three-Wheeler (EV Loader)',
      rating: 4.8,
      isVerified: false,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    };

    saveDealerApplication(mockApplicant);
    showToast(
      'Test Application Created (Local Sandbox)',
      `Simulated pending dealer with GST: ${mockApplicant.businessName}. Note: Mock record with no database UUID.`,
      'info'
    );
    if (!showDemoRecords && isConfigured && isSupabaseConfigured() && user) {
      setShowDemoRecords(true);
    } else {
      loadApplications();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Admin Verification Dashboard</span>
            </div>

            {isConfigured && isSupabaseConfigured() ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs font-bold">
                  <Database className="w-3 h-3 text-blue-400" />
                  <span>Supabase Live</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowDemoRecords((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                    showDemoRecords
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/35'
                      : 'bg-white/[0.04] text-gray-300 border-white/10 hover:bg-white/[0.08]'
                  }`}
                  title="Toggle local sandbox demo records in list"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{showDemoRecords ? 'Demo Rows Included' : 'Include Demo Rows'}</span>
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/35 text-xs font-bold">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Demo Sandbox (Offline)</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Dealer Applications & GST Review
          </h1>
          <p className="text-xs sm:text-sm text-[#9cb1a4] mt-1 max-w-2xl">
            Review incoming scrap merchant applications, manually verify GST credentials against the official portal, and record verification decisions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleSimulateNewApplicant}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-white/[0.05] hover:bg-white/[0.09] text-white border border-white/10 shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simulate New Application</span>
          </button>
          <button
            type="button"
            onClick={() => loadApplications()}
            className="p-2.5 rounded-xl text-gray-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Database Error Banner if any */}
      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs text-rose-200">Database Connection Notice</h4>
              <p className="text-xs text-rose-300/90 mt-0.5 leading-relaxed">{loadError}</p>
              <p className="text-[11px] text-rose-400/80 mt-0.5">
                Urban Scrap will not silently substitute mock data in production mode. Real database records only are queried.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowDemoRecords(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/35 hover:bg-amber-500/30"
            >
              Show Demo Data
            </button>
            <button
              type="button"
              onClick={() => loadApplications()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="p-4 sm:p-5 rounded-2xl glass-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-200/70 uppercase tracking-wider">
              Total Applicants
            </span>
            <Building2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
            {metrics.total}
          </div>
          <div className="text-[11px] text-[#9cb1a4] mt-0.5">Commercial scrap merchants</div>
        </div>

        {/* Pending */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/[0.08] border border-amber-500/25 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Pending GST Review
            </span>
            <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-200">
            {metrics.pending}
          </div>
          <div className="text-[11px] text-amber-300/80 mt-0.5">Awaiting manual admin audit</div>
        </div>

        {/* Verified */}
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/25 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              Verified Partners
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-300">
            {metrics.verified}
          </div>
          <div className="text-[11px] text-emerald-300/80 mt-0.5">Active dashboard access</div>
        </div>

        {/* Rejected */}
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/[0.08] border border-rose-500/25 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
              Rejected
            </span>
            <XCircle className="w-5 h-5 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-rose-300">
            {metrics.rejected}
          </div>
          <div className="text-[11px] text-rose-300/80 mt-0.5">Access denied / Resubmission open</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Pending Review ({metrics.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('verified')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              statusFilter === 'verified'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Verified ({metrics.verified})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              statusFilter === 'rejected'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Rejected ({metrics.rejected})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
          <input
            type="text"
            placeholder="Search business, GSTIN, legal name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-emerald-100/30 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Applications List Table */}
      {filteredApps.length === 0 ? (
        <div className="p-12 text-center glass-card rounded-2xl border border-white/[0.08] space-y-3">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 text-emerald-400 mx-auto flex items-center justify-center">
            <Filter className="w-6 h-6 stroke-[2]" />
          </div>
          <h3 className="font-extrabold text-base text-white">No Dealer Applications Found</h3>
          <p className="text-xs text-[#9cb1a4] max-w-md mx-auto">
            {searchTerm
              ? `No applicants matched "${searchTerm}". Try adjusting your search term.`
              : isConfigured && isSupabaseConfigured() && !showDemoRecords
              ? 'There are currently no dealer partner applications registered in your Supabase database.'
              : 'There are currently no dealer applications matching the selected filter.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            {isConfigured && isSupabaseConfigured() && !showDemoRecords && (
              <button
                type="button"
                onClick={() => setShowDemoRecords(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Show Demo Sandbox Records</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSimulateNewApplicant}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Test Application</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.03] text-[11px] font-bold text-emerald-200/70 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Business / Yard Name</th>
                  <th className="py-3.5 px-4">GSTIN & Legal Name</th>
                  <th className="py-3.5 px-4">Contact Person</th>
                  <th className="py-3.5 px-4">Operational Area</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-xs">
                {filteredApps.map((app) => {
                  const isDemoRow = app.isDemo || !isValidUuid(app.id);
                  return (
                    <tr key={app.id} className="hover:bg-white/[0.025] transition-colors">
                      {/* Business Name */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {app.businessName[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white block text-sm">
                                {app.businessName}
                              </span>
                              {isDemoRow ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-400" /> Demo Record
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                  <Database className="w-2.5 h-2.5 text-emerald-400" /> Database Live
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-emerald-100/50 font-mono block mt-0.5">
                              {isDemoRow ? `ID: ${app.id} (Local Sandbox)` : `UUID: ${app.id.slice(0, 8)}...${app.id.slice(-4)}`}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* GSTIN & Legal Name */}
                      <td className="py-4 px-4">
                        {app.gstin ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono font-bold text-[11px]">
                              {app.gstin}
                            </span>
                            <p className="text-[11px] text-[#9cb1a4] font-medium line-clamp-1">
                              {app.legalBusinessName || 'Not specified'}
                            </p>
                            {app.gstCertificateUrl && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                                <FileText className="w-3 h-3" /> Certificate Uploaded
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/[0.08] text-[11px] font-medium">
                            No GST Provided
                          </span>
                        )}
                      </td>

                      {/* Contact Person */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-white block">
                            {app.applicantName}
                          </span>
                          <div className="flex items-center gap-1.5 text-[#9cb1a4] text-[11px]">
                            <Phone className="w-3 h-3 text-emerald-400/70" />
                            <span>+91 {app.phone}</span>
                          </div>
                          {app.email && (
                            <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                              <Mail className="w-3 h-3 text-emerald-400/50" />
                              <span className="truncate max-w-[140px]">{app.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Operational Area */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-emerald-100/90">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-medium">{app.serviceArea}</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4 text-center">
                        {app.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            <span>Pending Review</span>
                          </span>
                        ) : app.status === 'verified' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Verified Partner</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            <XCircle className="w-3 h-3 text-rose-400" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedApp(app)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition-all active:scale-[0.98]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review & Verify</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {selectedApp && (() => {
        const isDemoSelected = selectedApp.isDemo || !isValidUuid(selectedApp.id);
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setSelectedApp(null)}
            />
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#091610]/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl border border-white/[0.12] text-white animate-in zoom-in-95 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      Dealer Verification Review
                    </span>
                    {isDemoSelected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Sparkles className="w-3 h-3 text-amber-400" /> Demo Sandbox (No DB UUID)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <Database className="w-3 h-3 text-emerald-400" /> Supabase Database Record
                      </span>
                    )}
                    {selectedApp.status === 'verified' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Verified Partner
                      </span>
                    ) : selectedApp.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Clock className="w-3 h-3 text-amber-400" /> Pending Review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        <XCircle className="w-3 h-3 text-rose-400" /> Rejected
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-extrabold text-white">
                    {selectedApp.businessName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06] -mr-1 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Demo Sandbox Alert or Supabase Live Confirmation */}
              {isDemoSelected ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 space-y-1.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-xs text-amber-300 uppercase tracking-wide">
                        Demo / Sandbox Application (ID: {selectedApp.id})
                      </h4>
                      <p className="text-xs text-amber-200/90 mt-0.5 leading-relaxed">
                        This application is local demonstration data and does not have a PostgreSQL database UUID. Database actions are skipped to prevent syntax errors. Review decisions (approve/reject) will be recorded only in your local browser sandbox.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Persisted Supabase Record: <code className="font-mono font-bold text-emerald-300">{selectedApp.id}</code>
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 self-start sm:self-auto">
                    Valid UUID
                  </span>
                </div>
              )}

              {/* Official GST Portal Manual Verification Banner */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <h4 className="font-extrabold text-amber-300">
                      Mandatory Manual Verification Protocol
                    </h4>
                    <p className="text-amber-200/90 mt-0.5 leading-relaxed">
                      Urban Scrap does not perform automated government lookups. The administrator must manually cross-verify the submitted GSTIN, legal business name, and active registration status on the official GST portal before granting approval.
                    </p>
                  </div>
                </div>

                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <a
                    href="https://services.gst.gov.in/services/searchtp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Official GST Portal (searchtp)</span>
                  </a>
                  {selectedApp.gstin && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedApp.gstin!)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.09] text-white border border-white/10 transition-colors"
                    >
                      {copiedGstin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedGstin ? 'Copied GSTIN' : 'Copy GSTIN'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Application Data Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* GSTIN Box */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-emerald-200/60 font-semibold">Submitted GSTIN</span>
                    {selectedApp.gstin && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedApp.gstin!)}
                        className="text-emerald-400 hover:underline font-bold inline-flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    )}
                  </div>
                  <div className="text-base font-mono font-extrabold text-white">
                    {selectedApp.gstin || 'No GSTIN submitted'}
                  </div>
                </div>

                {/* Legal Name */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-emerald-200/60 block font-semibold mb-1">GST-Registered Legal Name</span>
                  <span className="font-bold text-white block">
                    {selectedApp.legalBusinessName || selectedApp.businessName}
                  </span>
                </div>

                {/* State */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-emerald-200/60 block font-semibold mb-1">Registered State</span>
                  <span className="font-bold text-white block">
                    {selectedApp.state || 'Karnataka'}
                  </span>
                </div>

                {/* Registered Address */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] sm:col-span-2">
                  <span className="text-emerald-200/60 block font-semibold mb-1">Registered Business Address</span>
                  <span className="text-[#9cb1a4] block leading-relaxed">
                    {selectedApp.businessAddress || 'Not provided'}
                  </span>
                </div>

                {/* Certificate Download/View */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] sm:col-span-2">
                  <span className="text-emerald-200/60 block font-semibold mb-1">GST Registration Certificate</span>
                  {selectedApp.gstCertificateUrl ? (
                    <a
                      href={selectedApp.gstCertificateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Submitted Certificate (PDF/Image)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-gray-400 italic">No document file uploaded</span>
                  )}
                </div>

                {/* Contact and Operational info */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-emerald-200/60 block font-semibold mb-1">Contact Person</span>
                  <span className="font-bold text-white">{selectedApp.applicantName}</span>
                  <div className="text-[#9cb1a4] mt-1">+91 {selectedApp.phone}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-emerald-200/60 block font-semibold mb-1">Operational Fleet</span>
                  <span className="font-bold text-white">{selectedApp.vehicleType}</span>
                  <div className="text-[#9cb1a4] mt-1">{selectedApp.serviceArea}</div>
                </div>

                {/* Submission Date */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] sm:col-span-2">
                  <div className="flex items-center gap-2 text-emerald-200/70">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      Application Submitted:{' '}
                      <strong className="text-white">
                        {new Date(selectedApp.submittedAt || selectedApp.createdAt).toLocaleString()}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Audit History (if any) */}
              {auditReviews.length > 0 && (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                    <History className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Previous Review History</span>
                  </div>
                  <div className="divide-y divide-white/[0.06]">
                    {auditReviews.map((rev) => (
                      <div key={rev.id} className="py-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded-full ${
                            rev.action === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          }`}>
                            {rev.action}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(rev.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {rev.notes && (
                          <p className="text-[#9cb1a4] italic text-[11px]">{rev.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Review Notes & Actions */}
              <div className="space-y-3 pt-2 border-t border-white/[0.08]">
                <div>
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    Internal Review Notes (Optional for approval, recorded in audit log)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Cross-checked with GST portal. Name and address verified against Peenya tax jurisdiction."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-emerald-100/30 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* If rejecting, show required rejection reason */}
                {showRejectInput && (
                  <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 space-y-2 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-rose-300 font-bold text-xs">
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Rejection Reason (Required — shown to dealer for resubmission)</span>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="e.g. GSTIN provided does not match the legal business name or is marked inactive/cancelled on the GST portal."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-rose-500/40 bg-white/[0.04] text-white placeholder-rose-200/40 focus:outline-none focus:border-rose-400 transition-colors"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRejectInput(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/[0.06]"
                      >
                        Cancel Reject
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing || !rejectionReason.trim()}
                        onClick={() => handleConfirmReject(selectedApp)}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm disabled:opacity-50 transition-colors"
                      >
                        {isProcessing
                          ? 'Rejecting...'
                          : isDemoSelected
                          ? 'Confirm Rejection (Local Sandbox Only)'
                          : 'Confirm Rejection (Supabase)'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!showRejectInput && (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedApp(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      Close
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setShowRejectInput(true)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-colors"
                      >
                        Reject Application
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleApprove(selectedApp)}
                        className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${
                          isDemoSelected
                            ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/40'
                            : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                        }`}
                        title={
                          isDemoSelected
                            ? 'Local sandbox approval only (no database query)'
                            : 'Approve and activate dealer partner in Supabase'
                        }
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {isProcessing
                            ? 'Approving...'
                            : isDemoSelected
                            ? 'Approve (Local Sandbox Only)'
                            : 'Approve & Unlock Portal'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
