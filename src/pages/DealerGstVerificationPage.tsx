import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  FileCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useScrollAnimation } from '../utils/useScrollAnimation';

// Indian States and Union Territories list for GST registration
const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi (National Capital Territory)',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

// 15-character Indian GSTIN format validator regex
// 2 digits (state code) + 5 letters (PAN) + 4 digits + 1 letter + 1 entity num + 1 'Z' + 1 checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const DealerGstVerificationPage: React.FC = () => {
  const { dealer, submitDealerGst, refreshDealer } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  useScrollAnimation();

  // Form states
  const [gstin, setGstin] = useState(dealer?.gstin || '');
  const [legalBusinessName, setLegalBusinessName] = useState(dealer?.legal_business_name || dealer?.business_name || '');
  const [businessAddress, setBusinessAddress] = useState(dealer?.business_address || '');
  const [state, setState] = useState(dealer?.state || 'Karnataka');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePreviewUrl, setCertificatePreviewUrl] = useState<string | null>(dealer?.gst_certificate_url || null);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Sync with dealer state when dealer data loads
  useEffect(() => {
    if (dealer) {
      if (dealer.gstin) setGstin(dealer.gstin);
      if (dealer.legal_business_name) setLegalBusinessName(dealer.legal_business_name);
      if (dealer.business_address) setBusinessAddress(dealer.business_address);
      if (dealer.state) setState(dealer.state);
      if (dealer.gst_certificate_url) setCertificatePreviewUrl(dealer.gst_certificate_url);
    }
  }, [dealer]);

  // GSTIN format validation check (Format-only, clearly documented)
  const gstinValidation = useMemo(() => {
    const clean = gstin.trim().toUpperCase();
    if (!clean) return { valid: false, message: '' };
    if (clean.length < 15) {
      return { valid: false, message: `${15 - clean.length} characters remaining (must be 15 chars)` };
    }
    if (clean.length > 15) {
      return { valid: false, message: 'GSTIN exceeds 15 characters' };
    }
    const isValidFormat = GSTIN_REGEX.test(clean);
    return {
      valid: isValidFormat,
      message: isValidFormat
        ? 'Valid 15-character GSTIN structure format'
        : 'Format does not match standard 15-character GSTIN structure',
    };
  }, [gstin]);

  // Handle Certificate file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Certificate file must be smaller than 5 MB.');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setFormError('Only PDF, JPG, PNG, and WebP files are accepted.');
      return;
    }

    setFormError(null);
    setCertificateFile(file);
    if (file.type.startsWith('image/')) {
      setCertificatePreviewUrl(URL.createObjectURL(file));
    } else {
      setCertificatePreviewUrl(file.name);
    }
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanGstin = gstin.trim().toUpperCase();
    if (!GSTIN_REGEX.test(cleanGstin)) {
      setFormError('Please enter a valid 15-character Indian GSTIN (e.g. 29AABCU9603R1ZM). Format check is required.');
      return;
    }

    if (!legalBusinessName.trim() || legalBusinessName.trim().length < 3) {
      setFormError('Please enter the full legal business name as registered on the GST certificate.');
      return;
    }

    if (!businessAddress.trim() || businessAddress.trim().length < 8) {
      setFormError('Please enter the complete registered trade address.');
      return;
    }

    if (!state.trim()) {
      setFormError('Please select your registration State or Union Territory.');
      return;
    }

    if (!declarationAccepted) {
      setFormError('Please acknowledge the declaration checkbox before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitDealerGst({
        gstin: cleanGstin,
        legalBusinessName: legalBusinessName.trim(),
        businessAddress: businessAddress.trim(),
        state: state.trim(),
        gstCertificateFile: certificateFile,
        gstCertificateUrl: certificatePreviewUrl && !certificateFile ? certificatePreviewUrl : undefined,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        showToast(
          'GST Credentials Submitted',
          'Your GST details have been recorded and queued for administrative verification.',
          'success'
        );
        setIsEditing(false);
        await refreshDealer();
      }
    } catch {
      setFormError('An unexpected error occurred while saving your details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manual status refresh
  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      await refreshDealer();
      showToast('Status Updated', 'Refreshed dealer verification status.', 'info');
    } finally {
      setIsRefreshing(false);
    }
  };

  const status = dealer?.verification_status || (dealer?.is_verified ? 'approved' : 'pending');
  const hasSubmittedGst = Boolean(dealer?.gstin && dealer?.submitted_at);
  const showForm = !hasSubmittedGst || isEditing;

  return (
    <div className="min-h-screen text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#9cb1a4]">
          <Link to="/" className="hover:text-emerald-400 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white font-semibold">Dealer GST Verification</span>
        </div>

        {/* Page Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Merchant Regulatory Compliance</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Partner GST Verification
          </h1>
          <p className="text-sm sm:text-base text-[#9cb1a4] leading-relaxed">
            In compliance with Indian commercial scrap merchant guidelines, all Urban Scrap dealer partners must submit valid Goods and Services Tax (GSTIN) registration credentials before receiving collection route assignments.
          </p>
        </div>

        {/* Mandatory Prominent Review Notice */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 shadow-lg flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-extrabold text-sm sm:text-base text-amber-300">
              Important Verification Disclaimer
            </h4>
            <p className="text-xs sm:text-sm text-amber-200 font-medium leading-relaxed">
              “We’ll review your GST details. Submission does not mean GST registration is verified.”
            </p>
            <p className="text-[11px] sm:text-xs text-amber-200/80 leading-relaxed pt-1">
              Validating the 15-character format ensures syntactical correctness only. An Urban Scrap administrator will manually inspect and match your details against the official Government of India GST Portal before activating dealer privileges.
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* VIEW A: SUBMISSION FORM (When first submitting or re-editing)   */}
        {/* ============================================================== */}
        {showForm ? (
          <div className="glass-card rounded-3xl border border-white/[0.08] p-6 sm:p-8 shadow-2xl space-y-6 text-white">
            <div className="border-b border-white/[0.08] pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {hasSubmittedGst ? 'Resubmit Corrected GST Details' : 'Submit GST Credentials'}
                </h2>
                <p className="text-xs text-[#9cb1a4] mt-0.5">
                  Enter your 15-digit GSTIN exactly as registered under the Central Goods and Services Tax Act.
                </p>
              </div>
              {hasSubmittedGst && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Field 1: GSTIN */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="dealer-gstin" className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                    GSTIN (Goods and Services Tax Identification Number) <span className="text-rose-400">*</span>
                  </label>
                  <span className={`text-[11px] font-semibold ${gstinValidation.valid ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {gstinValidation.message}
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="dealer-gstin"
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                    placeholder="e.g. 29AABCU9603R1ZM"
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-mono tracking-wider transition-colors focus:outline-none focus:ring-2 ${
                      gstinValidation.valid
                        ? 'border-emerald-500 focus:ring-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        : gstin.length === 15
                        ? 'border-rose-400 focus:ring-rose-400/20 bg-rose-500/10 text-rose-300'
                        : 'border-white/10 bg-white/[0.04] text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                    }`}
                    required
                  />
                  {gstinValidation.valid && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 stroke-[2.3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-[#9cb1a4]">
                  Structure: 2 State Digits + 10 PAN Characters + 1 Entity + 1 Z + 1 Check Digit. Format check only.
                </p>
              </div>

              {/* Field 2: Legal Registered Business Name */}
              <div className="space-y-1.5">
                <label htmlFor="dealer-legal-name" className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                  Legal Business Name (As on GST Certificate) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="dealer-legal-name"
                    type="text"
                    value={legalBusinessName}
                    onChange={(e) => setLegalBusinessName(e.target.value)}
                    placeholder="e.g. GreenCycle Eco Recyclers Private Limited"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-emerald-100/30 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Field 3 & 4: Address and State */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="dealer-address" className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                    Registered Trade Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="dealer-address"
                    type="text"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    placeholder="e.g. Shed 14, Industrial Area, Whitefield"
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-emerald-100/30 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="dealer-state" className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                    Registration State <span className="text-rose-400">*</span>
                  </label>
                  <select
                    id="dealer-state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-white/10 bg-[#091610] text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                    required
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s} className="bg-[#091610] text-white">{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 5: GST Certificate Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-emerald-200 uppercase tracking-wider block">
                  GST Certificate Document / Registration Letter (PDF or Image)
                </label>
                <div className="border-2 border-dashed border-white/10 hover:border-emerald-500/50 rounded-2xl p-5 text-center transition-colors bg-white/[0.02]">
                  <input
                    id="gst-file-input"
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="gst-file-input" className="cursor-pointer space-y-2 block">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 text-emerald-400 mx-auto flex items-center justify-center shadow-sm">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-300 hover:underline">
                        Click to browse file
                      </span>
                      <span className="text-xs text-[#9cb1a4]"> or drag and drop</span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Supported formats: PDF, PNG, JPG, WebP (Max file size: 5 MB)
                    </p>
                  </label>

                  {certificatePreviewUrl && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300">
                      <FileCheck className="w-4 h-4 text-emerald-400" />
                      <span className="truncate max-w-[260px]">
                        {certificateFile ? certificateFile.name : 'GST_Registration_Certificate.pdf'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Field 6: Declaration Checkbox */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={declarationAccepted}
                    onChange={(e) => setDeclarationAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-white/20 bg-white/[0.04]"
                    required
                  />
                  <span className="text-xs text-[#9cb1a4] leading-relaxed select-none">
                    I solemnly declare that the GSTIN and business credentials provided above are authentic and correspond to our registered commercial enterprise. I understand that submission does not constitute verification until an authorized administrator verifies the record.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !gstinValidation.valid || !declarationAccepted}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-950/40 transition-all active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Recording GST Credentials...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Submit for Administrative Review</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ============================================================== */
          /* VIEW B: STATUS TRACKER & REVIEW DECISION CARD                  */
          /* ============================================================== */
          <div className="space-y-6">
            {/* Status Summary Banner */}
            <div className={`p-6 sm:p-7 rounded-3xl border shadow-2xl space-y-4 ${
              status === 'approved'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : status === 'rejected'
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                    status === 'approved'
                      ? 'bg-emerald-600 text-white'
                      : status === 'rejected'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}>
                    {status === 'approved' ? (
                      <CheckCircle2 className="w-7 h-7 stroke-[2.3]" />
                    ) : status === 'rejected' ? (
                      <XCircle className="w-7 h-7 stroke-[2.3]" />
                    ) : (
                      <Clock className="w-7 h-7 stroke-[2.3]" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200/70">
                      Application Status
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      {status === 'approved'
                        ? 'GST Verified & Approved'
                        : status === 'rejected'
                        ? 'Verification Unsuccessful'
                        : 'Verification Pending Review'}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRefreshStatus}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-gray-300 hover:text-white shadow-sm transition-all"
                  title="Refresh verification status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>

              {/* Status explanation */}
              <div className="text-xs sm:text-sm text-[#9cb1a4] leading-relaxed">
                {status === 'approved' && (
                  <p className="text-emerald-200 font-medium">
                    Congratulations! Your GST registration credentials have been manually inspected and verified by an Urban Scrap administrator. Your partner account is active and collection route access is enabled.
                  </p>
                )}
                {status === 'pending' && (
                  <p className="text-amber-200 font-medium">
                    Your GST details have been queued for manual cross-verification. Urban Scrap administrators verify active registration status on the official GST portal before activating accounts.
                  </p>
                )}
                {status === 'rejected' && (
                  <div className="space-y-2 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30">
                    <div className="flex items-center gap-1.5 text-rose-300 font-bold text-xs uppercase">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>Rejection Reason:</span>
                    </div>
                    <p className="text-xs sm:text-sm text-rose-200 font-semibold leading-relaxed">
                      {dealer?.rejection_reason || 'GST credentials did not match official government records or registration status is inactive.'}
                    </p>
                    {dealer?.review_notes && (
                      <p className="text-xs text-rose-300/70 pt-1">
                        <strong>Reviewer note:</strong> {dealer.review_notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                {status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => navigate('/dealer')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition-all"
                  >
                    <span>Launch Dealer Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {status === 'rejected' && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Correct Details & Resubmit</span>
                  </button>
                )}

                {status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-white transition-colors"
                  >
                    <span>Edit Submitted Information</span>
                  </button>
                )}

                <a
                  href="https://services.gst.gov.in/services/searchtp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
                >
                  <span>Public GST Search Tool</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Submitted Credential Card Details */}
            <div className="glass-card rounded-3xl border border-white/[0.08] p-6 sm:p-7 shadow-2xl space-y-4">
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-emerald-300">
                Submitted Business & GST Details
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-emerald-200/60 block text-[11px] font-bold uppercase">Submitted GSTIN</span>
                  <span className="font-mono text-sm font-extrabold text-white block mt-1 tracking-wider">
                    {dealer?.gstin || 'Not provided'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-emerald-200/60 block text-[11px] font-bold uppercase">Legal Entity Name</span>
                  <span className="font-bold text-white block mt-1">
                    {dealer?.legal_business_name || dealer?.business_name || 'Not provided'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-emerald-200/60 block text-[11px] font-bold uppercase">Registered Address</span>
                  <span className="text-[#9cb1a4] block mt-1">
                    {dealer?.business_address || 'Not provided'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-emerald-200/60 block text-[11px] font-bold uppercase">State / Territory</span>
                  <span className="text-white font-semibold block mt-1">
                    {dealer?.state || 'Karnataka'}
                  </span>
                </div>
              </div>

              {dealer?.gst_certificate_url && (
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-emerald-200/60 uppercase block mb-1.5">
                    GST Certificate Document
                  </span>
                  <a
                    href={dealer.gst_certificate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 font-semibold text-xs border border-emerald-500/30 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>View Submitted Certificate Document</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-300/70" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Security & Support Footer */}
        <div className="text-center text-xs text-[#9cb1a4] pt-4">
          Need assistance with GST document submission? Contact Urban Scrap Partner Support at{' '}
          <a href="mailto:partners@urbanscrap.in" className="text-emerald-400 hover:underline font-semibold">
            partners@urbanscrap.in
          </a>
        </div>
      </div>
    </div>
  );
};
