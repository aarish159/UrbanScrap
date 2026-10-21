import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Truck,
  Plus,
  Trash2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Info,
  Sparkles,
  Check,
  Scale,
} from 'lucide-react';
import { Stepper } from '../components/ui/Stepper';
import { SAMPLE_MATERIALS, TIME_SLOTS, POPULAR_CITIES, DEMO_DEALER } from '../data/mockData';
import type { SelectedMaterialItem, PickupAddress, Booking } from '../types';
import { formatINR, formatDate } from '../utils/formatters';
import { saveBooking } from '../utils/storage';
import { useToast } from '../components/ui/Toast';

export const BookingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [submittedBooking, setSubmittedBooking] = useState<Booking | null>(null);

  // STEP 1 STATE: Selected Materials
  const [selectedItems, setSelectedItems] = useState<SelectedMaterialItem[]>([]);
  const [selectedCatalogueId, setSelectedCatalogueId] = useState<string>('');
  const [materialError, setMaterialError] = useState<string | null>(null);

  // STEP 2 STATE: Pickup Address & Time
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [addressForm, setAddressForm] = useState<PickupAddress>({
    fullName: '',
    phoneNumber: '',
    email: '',
    streetAddress: '',
    area: '',
    city: 'Bengaluru',
    pincode: '',
    preferredDate: tomorrowStr,
    timeSlot: TIME_SLOTS[0],
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Check URL query param for preselected material (from Price Directory "Add to pickup")
  useEffect(() => {
    const paramMatId = searchParams.get('material');
    if (paramMatId) {
      const match = SAMPLE_MATERIALS.find((m) => m.id === paramMatId);
      if (match && !selectedItems.some((i) => i.materialId === match.id)) {
        setSelectedItems([
          {
            materialId: match.id,
            materialName: match.name,
            category: match.category,
            quantity: match.minQuantity || 10,
            unit: match.unit,
            ratePerUnit: match.indicativeRate,
            estimatedSubtotal: (match.minQuantity || 10) * match.indicativeRate,
          },
        ]);
      }
    } else if (selectedItems.length === 0) {
      // Default initial material so user doesn't start with a completely empty form
      const defaultMat = SAMPLE_MATERIALS[0];
      setSelectedItems([
        {
          materialId: defaultMat.id,
          materialName: defaultMat.name,
          category: defaultMat.category,
          quantity: 15,
          unit: defaultMat.unit,
          ratePerUnit: defaultMat.indicativeRate,
          estimatedSubtotal: 15 * defaultMat.indicativeRate,
        },
      ]);
    }
  }, [searchParams]);

  // Compute total estimated value
  const estimatedTotal = useMemo(() => {
    return selectedItems.reduce((acc, curr) => acc + curr.estimatedSubtotal, 0);
  }, [selectedItems]);

  // Material helpers
  const handleAddMaterial = (matId: string) => {
    if (!matId) return;
    const mat = SAMPLE_MATERIALS.find((m) => m.id === matId);
    if (!mat) return;

    if (selectedItems.some((i) => i.materialId === mat.id)) {
      setMaterialError(`${mat.name} is already added in your pickup list.`);
      return;
    }

    setMaterialError(null);
    const initialQty = mat.minQuantity || 5;
    setSelectedItems((prev) => [
      ...prev,
      {
        materialId: mat.id,
        materialName: mat.name,
        category: mat.category,
        quantity: initialQty,
        unit: mat.unit,
        ratePerUnit: mat.indicativeRate,
        estimatedSubtotal: initialQty * mat.indicativeRate,
      },
    ]);
    setSelectedCatalogueId('');
  };

  const handleUpdateQuantity = (materialId: string, qty: number) => {
    const validQty = Math.max(1, isNaN(qty) ? 1 : qty);
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.materialId === materialId) {
          return {
            ...item,
            quantity: validQty,
            estimatedSubtotal: validQty * item.ratePerUnit,
          };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (materialId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.materialId !== materialId));
  };

  // STEP 1 VALIDATION & PROCEED
  const validateStep1 = () => {
    if (selectedItems.length === 0) {
      setMaterialError('Please select at least one material to proceed with pickup.');
      return false;
    }
    const hasZeroOrNegative = selectedItems.some((i) => i.quantity <= 0);
    if (hasZeroOrNegative) {
      setMaterialError('All selected materials must have a quantity greater than zero.');
      return false;
    }
    setMaterialError(null);
    return true;
  };

  const handleProceedToStep2 = () => {
    if (validateStep1()) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // STEP 2 VALIDATION & PROCEED
  const validateStep2 = () => {
    const errors: Record<string, string> = {};

    if (!addressForm.fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }

    const phoneClean = addressForm.phoneNumber.replace(/\D/g, '');
    if (!phoneClean) {
      errors.phoneNumber = 'Mobile number is required.';
    } else if (phoneClean.length !== 10) {
      errors.phoneNumber = 'Enter a valid 10-digit Indian mobile number.';
    }

    if (addressForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addressForm.email)) {
      errors.email = 'Enter a valid email address.';
    }

    if (!addressForm.streetAddress.trim()) {
      errors.streetAddress = 'Door / flat number and building address are required.';
    }

    if (!addressForm.area.trim()) {
      errors.area = 'Locality or sector is required.';
    }

    if (!addressForm.city.trim()) {
      errors.city = 'City is required.';
    }

    const pinClean = addressForm.pincode.replace(/\D/g, '');
    if (!pinClean) {
      errors.pincode = 'PIN code is required.';
    } else if (pinClean.length !== 6) {
      errors.pincode = 'Enter a valid 6-digit Indian PIN code.';
    }

    if (!addressForm.preferredDate) {
      errors.preferredDate = 'Please select a preferred pickup date.';
    }

    if (!addressForm.timeSlot) {
      errors.timeSlot = 'Please select a pickup time slot.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceedToStep3 = () => {
    if (validateStep2()) {
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // STEP 3 SUBMISSION
  const handleConfirmBooking = () => {
    // Generate unique Indian style booking ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newBookingId = `US-2026-${randomSuffix}`;

    const newBooking: Booking = {
      id: newBookingId,
      createdAt: new Date().toISOString(),
      status: 'dealer_assigned',
      isDemoSample: false,
      materials: selectedItems,
      estimatedTotal,
      address: addressForm,
      assignedDealer: DEMO_DEALER,
      statusHistory: [
        {
          status: 'requested',
          timestamp: new Date().toISOString(),
          note: 'Doorstep pickup requested by customer.',
        },
        {
          status: 'dealer_assigned',
          timestamp: new Date(Date.now() + 5000).toISOString(),
          note: `Demo dealer assigned: ${DEMO_DEALER.name} (${DEMO_DEALER.businessName}).`,
        },
      ],
    };

    saveBooking(newBooking);
    setSubmittedBooking(newBooking);
    showToast('Pickup Scheduled!', `Booking ID ${newBookingId} has been created.`, 'success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const steps = [
    { id: 1, title: 'Materials', subtitle: 'Select Scrap' },
    { id: 2, title: 'Pickup Details', subtitle: 'Date & Address' },
    { id: 3, title: 'Review', subtitle: 'Confirm & Assign' },
  ];

  // SUCCESS SCREEN
  if (submittedBooking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#e8e8e3] shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center shadow-inner">
            <Check className="w-9 h-9 stroke-[3] text-emerald-600" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Demo Request Created
            </span>
            <h1 className="text-3xl font-extrabold text-[#143e29]">
              Pickup request received!
            </h1>
            <p className="text-sm text-[#555c58] max-w-lg mx-auto">
              Your mock pickup has been scheduled and assigned to a demo scrap dealer.
            </p>
          </div>

          {/* Prototype disclaimer pill */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 text-left flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Frontend Demonstration Notice: </span>
              This is a client-side demo running on local storage. No physical pickup truck will arrive and no real phone calls will be placed.
            </div>
          </div>

          {/* Booking Summary Card */}
          <div className="bg-[#fbfbf9] rounded-2xl p-6 text-left border border-[#e8e8e3] space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#e8e8e3] gap-2">
              <div>
                <span className="text-xs text-[#717a75]">Booking Reference</span>
                <p className="font-extrabold text-lg text-[#143e29]">{submittedBooking.id}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#717a75]">Estimated Payout</span>
                <p className="font-extrabold text-lg text-[#16a34a]">
                  {formatINR(submittedBooking.estimatedTotal)}
                </p>
              </div>
            </div>

            {/* Assigned Demo Dealer Card */}
            <div className="p-4 rounded-xl bg-white border border-[#e2e4e1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#143e29] text-[#4ade80] flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[#143e29]">
                      {submittedBooking.assignedDealer?.name}
                    </span>
                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-blue-100 text-blue-800">
                      Mock Assigned
                    </span>
                  </div>
                  <p className="text-xs text-[#717a75]">
                    {submittedBooking.assignedDealer?.businessName} • {submittedBooking.assignedDealer?.vehicleType}
                  </p>
                </div>
              </div>
              <div className="text-xs text-[#555c58] sm:text-right">
                <span className="font-semibold block">{submittedBooking.address.timeSlot}</span>
                <span>{formatDate(submittedBooking.address.preferredDate)}</span>
              </div>
            </div>

            {/* Address & Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#555c58] pt-1">
              <div>
                <span className="font-bold text-[#143e29] block mb-1">Pickup Address:</span>
                <p>{submittedBooking.address.fullName}</p>
                <p>{submittedBooking.address.streetAddress}, {submittedBooking.address.area}</p>
                <p>{submittedBooking.address.city} - {submittedBooking.address.pincode}</p>
                <p>Phone: +91 {submittedBooking.address.phoneNumber}</p>
              </div>
              <div>
                <span className="font-bold text-[#143e29] block mb-1">Scrap Materials ({submittedBooking.materials.length}):</span>
                <ul className="space-y-1">
                  {submittedBooking.materials.map((m) => (
                    <li key={m.materialId} className="flex justify-between">
                      <span>• {m.materialName} ({m.quantity} {m.unit})</span>
                      <span className="font-semibold text-[#143e29]">{formatINR(m.estimatedSubtotal)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/bookings"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-[#143e29] hover:bg-[#1a5336] text-white shadow-md transition-all"
            >
              <span>View in My Bookings</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/dealer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all"
            >
              <span>Inspect in Dealer Dashboard</span>
            </Link>

            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-white text-[#555c58] border border-[#d1d5db] hover:bg-[#f1f3f1] transition-all"
            >
              <span>Return Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#143e29] tracking-tight">
          Book Doorstep Scrap Pickup
        </h1>
        <p className="text-sm text-[#555c58]">
          Transparent indicative rates, certified digital weighing, on-the-spot payment.
        </p>
      </div>

      {/* Stepper */}
      <Stepper
        steps={steps}
        currentStep={currentStep}
        onStepClick={(s) => setCurrentStep(s)}
      />

      {/* STEP 1: MATERIALS SELECTION */}
      {currentStep === 1 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e8e8e3] shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#f1f3f1] gap-2">
            <div>
              <h2 className="text-xl font-bold text-[#143e29]">
                Step 1: Select Scrap Materials
              </h2>
              <p className="text-xs text-[#717a75] mt-0.5">
                Add the materials you want to sell and enter your approximate quantity.
              </p>
            </div>
            <Link
              to="/prices"
              target="_blank"
              className="text-xs font-bold text-[#16a34a] hover:underline flex items-center gap-1"
            >
              <span>View full price catalogue</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Material Add dropdown picker */}
          <div className="p-4 rounded-2xl bg-[#f8faf9] border border-[#e2e4e1] space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#555c58]">
              Add Material from Catalogue
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedCatalogueId}
                onChange={(e) => setSelectedCatalogueId(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#d1d5db] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              >
                <option value="">-- Choose a material to add --</option>
                {SAMPLE_MATERIALS.map((mat) => {
                  const isAdded = selectedItems.some((i) => i.materialId === mat.id);
                  return (
                    <option key={mat.id} value={mat.id} disabled={isAdded}>
                      {mat.name} ({formatINR(mat.indicativeRate)} / {mat.unit}) {isAdded ? '✓ Added' : ''}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={() => handleAddMaterial(selectedCatalogueId)}
                disabled={!selectedCatalogueId}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#143e29] hover:bg-[#16a34a] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
            </div>
          </div>

          {/* Validation Error Message */}
          {materialError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{materialError}</span>
            </div>
          )}

          {/* Selected Materials List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#717a75]">
              Items In Your Pickup ({selectedItems.length})
            </h3>

            {selectedItems.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-[#e2e4e1] rounded-2xl text-[#717a75] space-y-2">
                <Scale className="w-8 h-8 text-[#9aa19d] mx-auto" />
                <p className="text-sm font-medium">Your pickup list is empty</p>
                <p className="text-xs text-[#9aa19d]">
                  Select scrap items above to calculate your estimated payout.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#f1f3f1] border border-[#e8e8e3] rounded-2xl overflow-hidden">
                {selectedItems.map((item) => (
                  <div
                    key={item.materialId}
                    className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fbfbf9] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-[#143e29]">
                          {item.materialName}
                        </span>
                      </div>
                      <p className="text-xs text-[#717a75] mt-0.5">
                        Sample indicative rate: {formatINR(item.ratePerUnit)} per {item.unit}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Quantity input */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-[#717a75] font-medium">Qty:</label>
                        <input
                          type="number"
                          min="1"
                          max="5000"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(item.materialId, parseInt(e.target.value, 10))
                          }
                          className="w-20 px-2.5 py-1.5 text-sm font-bold text-center rounded-lg border border-[#d1d5db] focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                        />
                        <span className="text-xs font-semibold text-[#555c58]">{item.unit}</span>
                      </div>

                      {/* Subtotal */}
                      <div className="w-28 text-right">
                        <span className="text-xs text-[#717a75] block">Subtotal</span>
                        <span className="font-extrabold text-sm text-[#143e29]">
                          {formatINR(item.estimatedSubtotal)}
                        </span>
                      </div>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.materialId)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove scrap item"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing Estimation Bar */}
          <div className="p-4 rounded-2xl bg-[#eef7f1] border border-[#bbf7d0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-[#226f48] block">
                Total Estimated Value
              </span>
              <span className="text-2xl font-black text-[#143e29]">
                {formatINR(estimatedTotal)}
              </span>
              <span className="text-[11px] text-[#555c58] block mt-0.5">
                (Indicative sample estimate based on your provided weights)
              </span>
            </div>

            <div className="text-xs text-[#3f4441] max-w-sm sm:text-right">
              <span className="font-bold text-[#143e29]">Notice: </span>
              Final payout is determined after physical check & electronic scale weighing by the authorized partner.
            </div>
          </div>

          {/* Next Button */}
          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={handleProceedToStep2}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md shadow-[#16a34a]/20 transition-all focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
            >
              <span>Continue to Pickup Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PICKUP DETAILS */}
      {currentStep === 2 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e8e8e3] shadow-sm space-y-6">
          <div className="pb-4 border-b border-[#f1f3f1]">
            <h2 className="text-xl font-bold text-[#143e29]">
              Step 2: Pickup Address & Preferred Time
            </h2>
            <p className="text-xs text-[#717a75] mt-0.5">
              Enter your contact information and scheduled doorstep slot.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-[#191c1a] mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={addressForm.fullName}
                  onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                  className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                    formErrors.fullName
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-[#d1d5db] focus:ring-[#16a34a]'
                  }`}
                />
              </div>
              {formErrors.fullName && (
                <p className="text-xs text-rose-500 mt-1">{formErrors.fullName}</p>
              )}
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-bold text-[#191c1a] mb-1">
                Mobile Number (for pickup OTP / coordination) <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-[#d1d5db] bg-[#f8faf9] text-xs font-bold text-[#555c58]">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={addressForm.phoneNumber}
                  onChange={(e) =>
                    setAddressForm({
                      ...addressForm,
                      phoneNumber: e.target.value.replace(/\D/g, ''),
                    })
                  }
                  className={`w-full px-3.5 py-2.5 text-sm rounded-r-xl border bg-white focus:outline-none focus:ring-2 ${
                    formErrors.phoneNumber
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-[#d1d5db] focus:ring-[#16a34a]'
                  }`}
                />
              </div>
              {formErrors.phoneNumber && (
                <p className="text-xs text-rose-500 mt-1">{formErrors.phoneNumber}</p>
              )}
            </div>

            {/* Email (Optional) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#191c1a] mb-1">
                Email Address <span className="text-[#9aa19d] font-normal">(Optional, for digital receipt)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={addressForm.email}
                  onChange={(e) => setAddressForm({ ...addressForm, email: e.target.value })}
                  className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                    formErrors.email
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-[#d1d5db] focus:ring-[#16a34a]'
                  }`}
                />
              </div>
              {formErrors.email && (
                <p className="text-xs text-rose-500 mt-1">{formErrors.email}</p>
              )}
            </div>

            {/* Street Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#191c1a] mb-1">
                Flat / House / Floor / Building Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-[#717a75]" />
                <textarea
                  rows={2}
                  placeholder="e.g. Flat 304, Green Meadows, 12th Main Road"
                  value={addressForm.streetAddress}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, streetAddress: e.target.value })
                  }
                  className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                    formErrors.streetAddress
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-[#d1d5db] focus:ring-[#16a34a]'
                  }`}
                />
              </div>
              {formErrors.streetAddress && (
                <p className="text-xs text-rose-500 mt-1">{formErrors.streetAddress}</p>
              )}
            </div>

            {/* Area / Locality */}
            <div>
              <label className="block text-xs font-bold text-[#191c1a] mb-1">
                Area / Locality <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Koramangala 4th Block"
                value={addressForm.area}
                onChange={(e) => setAddressForm({ ...addressForm, area: e.target.value })}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                  formErrors.area
                    ? 'border-rose-400 focus:ring-rose-400'
                    : 'border-[#d1d5db] focus:ring-[#16a34a]'
                }`}
              />
              {formErrors.area && (
                <p className="text-xs text-rose-500 mt-1">{formErrors.area}</p>
              )}
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-bold text-[#191c1a] mb-1">
                City <span className="text-rose-500">*</span>
              </label>
              <select
                value={addressForm.city}
                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              >
                {POPULAR_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Pincode */}
            <div>
              <label className="block text-xs font-bold text-[#191c1a] mb-1">
                PIN Code (6 digits) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="560034"
                value={addressForm.pincode}
                onChange={(e) =>
                  setAddressForm({
                    ...addressForm,
                    pincode: e.target.value.replace(/\D/g, ''),
                  })
                }
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 ${
                  formErrors.pincode
                    ? 'border-rose-400 focus:ring-rose-400'
                    : 'border-[#d1d5db] focus:ring-[#16a34a]'
                }`}
              />
              {formErrors.pincode && (
                <p className="text-xs text-rose-500 mt-1">{formErrors.pincode}</p>
              )}
            </div>

            {/* Preferred Date */}
            <div>
              <label className="block text-xs font-bold text-[#191c1a] mb-1">
                Preferred Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717a75]" />
                <input
                  type="date"
                  min={tomorrowStr}
                  value={addressForm.preferredDate}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, preferredDate: e.target.value })
                  }
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
                />
              </div>
            </div>

            {/* Preferred Time Slot */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#191c1a] mb-1">
                Preferred Time Slot <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {TIME_SLOTS.map((slot) => {
                  const isSelected = addressForm.timeSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setAddressForm({ ...addressForm, timeSlot: slot })}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold text-left flex items-center justify-between border transition-all ${
                        isSelected
                          ? 'bg-[#143e29] text-white border-[#143e29] shadow-sm'
                          : 'bg-white text-[#3f4441] border-[#d1d5db] hover:border-[#143e29]'
                      }`}
                    >
                      <span>{slot}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#4ade80]" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#717a75] mt-1.5">
                Note: Sample time slots for demo. Not linked to live real-time dealer GPS.
              </p>
            </div>

            {/* Pickup Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#191c1a] mb-1">
                Special Instructions / Notes <span className="text-[#9aa19d] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Lift is operational, scrap is packed in sacks on balcony, ring bell twice"
                value={addressForm.notes}
                onChange={(e) => setAddressForm({ ...addressForm, notes: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#d1d5db] bg-white focus:outline-none focus:ring-2 focus:ring-[#16a34a]"
              />
            </div>
          </div>

          {/* Stepper buttons */}
          <div className="pt-4 flex items-center justify-between border-t border-[#f1f3f1]">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-[#555c58] hover:text-[#191c1a] hover:bg-[#f1f3f1] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Materials</span>
            </button>

            <button
              type="button"
              onClick={handleProceedToStep3}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md transition-all"
            >
              <span>Review Booking Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & CONFIRM */}
      {currentStep === 3 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e8e8e3] shadow-sm space-y-6">
          <div className="pb-4 border-b border-[#f1f3f1]">
            <h2 className="text-xl font-bold text-[#143e29]">
              Step 3: Review Your Pickup Request
            </h2>
            <p className="text-xs text-[#717a75] mt-0.5">
              Verify your scrap inventory, address, and scheduled pickup slot before confirmation.
            </p>
          </div>

          {/* Materials summary table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#717a75]">
                Scrap Items Breakdown
              </h3>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs font-bold text-[#16a34a] hover:underline"
              >
                Edit Materials
              </button>
            </div>

            <div className="border border-[#e8e8e3] rounded-2xl overflow-hidden divide-y divide-[#f1f3f1]">
              {selectedItems.map((item) => (
                <div
                  key={item.materialId}
                  className="px-4 py-3 flex items-center justify-between text-sm bg-white"
                >
                  <div>
                    <span className="font-bold text-[#143e29]">{item.materialName}</span>
                    <span className="text-xs text-[#717a75] block">
                      {item.quantity} {item.unit} @ {formatINR(item.ratePerUnit)}/{item.unit}
                    </span>
                  </div>
                  <span className="font-extrabold text-[#143e29]">
                    {formatINR(item.estimatedSubtotal)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="p-4 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#16a34a] uppercase tracking-wider block">
                  Total Estimated Value
                </span>
                <span className="text-xs text-[#717a75]">Subject to on-site digital weighing</span>
              </div>
              <span className="text-2xl font-black text-[#143e29]">
                {formatINR(estimatedTotal)}
              </span>
            </div>
          </div>

          {/* Address & Slot summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-[#fbfbf9] border border-[#e8e8e3] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#717a75]">
                  Doorstep Address
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-bold text-[#16a34a] hover:underline"
                >
                  Edit
                </button>
              </div>
              <div className="text-xs text-[#3f4441] space-y-1">
                <p className="font-bold text-sm text-[#143e29]">{addressForm.fullName}</p>
                <p>{addressForm.streetAddress}</p>
                <p>{addressForm.area}, {addressForm.city} - {addressForm.pincode}</p>
                <p className="pt-1 font-semibold text-[#143e29]">
                  Phone: +91 {addressForm.phoneNumber}
                </p>
                {addressForm.email && <p>Email: {addressForm.email}</p>}
                {addressForm.notes && (
                  <p className="text-[#717a75] italic pt-1">
                    Note: "{addressForm.notes}"
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#fbfbf9] border border-[#e8e8e3] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#717a75]">
                  Pickup Slot
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-bold text-[#16a34a] hover:underline"
                >
                  Edit
                </button>
              </div>
              <div className="text-xs text-[#3f4441] space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#16a34a]" />
                  <span className="font-bold text-sm text-[#143e29]">
                    {formatDate(addressForm.preferredDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#16a34a]" />
                  <span className="font-medium text-[#191c1a]">{addressForm.timeSlot}</span>
                </div>
                <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                  Dealer coordinates with you approx. 30 mins prior to arrival.
                </div>
              </div>
            </div>
          </div>

          {/* Prototype Disclosure Alert */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              By clicking "Confirm pickup request", this booking will be saved in your browser's local demo database. A sample verified dealer partner will be assigned automatically.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-between border-t border-[#f1f3f1]">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-[#555c58] hover:text-[#191c1a] hover:bg-[#f1f3f1] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmBooking}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white shadow-lg shadow-[#16a34a]/30 hover:shadow-xl active:scale-[0.98] transition-all"
            >
              <CheckCircle2 className="w-5 h-5 stroke-[2.3]" />
              <span>Confirm pickup request</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
