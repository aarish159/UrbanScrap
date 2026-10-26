import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Truck,
  Plus,
  Trash2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Sparkles,
  Check,
  Scale,
  Minus,
  ShieldCheck,
} from 'lucide-react';
import { Stepper } from '../components/ui/Stepper';
import { CustomerPhotoUpload } from '../components/booking/CustomerPhotoUpload';
import { compressImageFile } from '../utils/imageUtils';
import { SAMPLE_MATERIALS, TIME_SLOTS, POPULAR_CITIES, DEMO_DEALER } from '../data/mockData';
import type { SelectedMaterialItem, PickupAddress, Booking, Material } from '../types';
import { formatINR, formatDate } from '../utils/formatters';
import { saveBooking } from '../utils/storage';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const BookingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { user, profile, openAuthModal } = useAuth();
  const isConfigured = isSupabaseConfigured();

  const [currentStep, setCurrentStep] = useState(1);
  const [submittedBooking, setSubmittedBooking] = useState<Booking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [materialsList, setMaterialsList] = useState<Material[]>(SAMPLE_MATERIALS);

  // STEP 1 STATE: Selected Materials (starts completely empty unless ?material= is present)
  const [selectedItems, setSelectedItems] = useState<SelectedMaterialItem[]>(() => {
    const paramMatId = searchParams.get('material');
    if (paramMatId) {
      const match = SAMPLE_MATERIALS.find((m) => m.id === paramMatId);
      if (match) {
        const initialQty = match.minQuantity || 10;
        return [
          {
            materialId: match.id,
            materialName: match.name,
            category: match.category,
            quantity: initialQty,
            unit: match.unit,
            ratePerUnit: match.indicativeRate,
            estimatedSubtotal: initialQty * match.indicativeRate,
          },
        ];
      }
    }
    return [];
  });
  const [selectedCatalogueId, setSelectedCatalogueId] = useState<string>('');
  const [materialError, setMaterialError] = useState<string | null>(null);

  // Optional customer scrap photos for dealer review
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const handleAddPhotos = (newFiles: File[]) => {
    setSelectedPhotos((prev) => [...prev, ...newFiles]);
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemovePhoto = (index: number) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => {
      const removed = prev[index];
      if (removed && removed.startsWith('blob:')) {
        URL.revokeObjectURL(removed);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleAddDemoPhoto = async () => {
    try {
      const res = await fetch('/demo/scrap-sample.jpg');
      if (!res.ok) throw new Error('Demo sample not found');
      const blob = await res.blob();
      const demoFile = new File([blob], 'scrap-sample.jpg', { type: 'image/jpeg' });
      handleAddPhotos([demoFile]);
      showToast('Demo Photo Added', 'Sample scrap photo attached for dealer review.', 'info');
    } catch {
      showToast('Demo Photo Error', 'Could not load demo sample photo.', 'error');
    }
  };

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

  // Auto-prefill contact details from authenticated user profile
  useEffect(() => {
    if (user) {
      setAddressForm((prev) => ({
        ...prev,
        fullName: prev.fullName || profile?.full_name || '',
        phoneNumber: prev.phoneNumber || profile?.phone || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user, profile]);

  // Fetch active materials from Supabase if configured
  useEffect(() => {
    if (isConfigured) {
      supabase
        .from('materials')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .then(({ data }) => {
          if (data && data.length > 0) {
            setMaterialsList(
              data.map((m) => ({
                id: m.id,
                name: m.name,
                category: m.category,
                indicativeRate: Number(m.indicative_rate),
                unit: m.unit,
                description: m.description,
                popular: m.popular,
                minQuantity: Number(m.min_quantity),
              }))
            );
          }
        });
    }
  }, [isConfigured]);

  // Compute total estimated value
  const estimatedTotal = useMemo(() => {
    return selectedItems.reduce((acc, curr) => acc + curr.estimatedSubtotal, 0);
  }, [selectedItems]);

  // Material helpers
  const handleAddMaterial = (matId: string) => {
    if (!matId) return;
    const mat = materialsList.find((m) => m.id === matId);
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

  const handleIncrement = (materialId: string) => {
    const current = selectedItems.find((i) => i.materialId === materialId);
    if (current) {
      handleUpdateQuantity(materialId, current.quantity + 1);
    }
  };

  const handleDecrement = (materialId: string) => {
    const current = selectedItems.find((i) => i.materialId === materialId);
    if (current && current.quantity > 1) {
      handleUpdateQuantity(materialId, current.quantity - 1);
    }
  };

  const handleRemoveItem = (materialId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.materialId !== materialId));
  };

  // STEP 1 VALIDATION & PROCEED
  const validateStep1 = () => {
    if (selectedItems.length === 0) {
      setMaterialError('Please select at least one scrap material to proceed with pickup.');
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
  const handleConfirmBooking = async () => {
    // Generate UUID for booking: strictly conforms to <customer UUID>/<booking UUID>/<unique filename>
    const bookingUuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    const newBookingId = bookingUuid;

    if (isConfigured) {
      if (!user) {
        openAuthModal();
        showToast('Account Required', 'Please sign in or create an account to schedule your pickup.', 'info');
        return;
      }

      setIsSubmitting(true);
      const uploadedPhotoPaths: string[] = [];

      try {
        // Upload customer photos to private Storage bucket 'booking-photos'
        if (selectedPhotos.length > 0) {
          for (let i = 0; i < selectedPhotos.length; i++) {
            const photoFile = selectedPhotos[i];
            const { blob } = await compressImageFile(photoFile);

            // Generate unique filename for photo: <photo UUID>.jpg
            const photoUniqueId =
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}-${i + 1}`;
            const uniqueFilename = `${photoUniqueId}.jpg`;

            // Bucket-relative path: <customer UUID>/<booking UUID>/<unique filename>
            // Note: Does not prefix with 'booking-photos/'
            const storagePath = `${user.id}/${newBookingId}/${uniqueFilename}`;

            const { error: uploadErr } = await supabase.storage
              .from('booking-photos')
              .upload(storagePath, blob, {
                contentType: 'image/jpeg',
                upsert: false,
              });

            if (uploadErr) {
              throw new Error(`Failed to upload photo #${i + 1}: ${uploadErr.message}`);
            }
            uploadedPhotoPaths.push(storagePath);
          }
        }

        // 1. Insert into public.bookings
        const { error: bErr } = await supabase.from('bookings').insert({
          id: newBookingId,
          customer_id: user.id,
          status: 'requested',
          customer_name: addressForm.fullName.trim(),
          phone_number: addressForm.phoneNumber.replace(/\D/g, ''),
          email: addressForm.email || user.email || null,
          street_address: addressForm.streetAddress.trim(),
          area: addressForm.area.trim(),
          city: addressForm.city.trim(),
          pincode: addressForm.pincode.replace(/\D/g, ''),
          preferred_date: addressForm.preferredDate,
          time_slot: addressForm.timeSlot,
          notes: addressForm.notes?.trim() || null,
          estimated_total: estimatedTotal,
          photo_paths: uploadedPhotoPaths.length > 0 ? uploadedPhotoPaths : null,
        });

        if (bErr) {
          // Clean up uploaded files if database booking insertion fails
          if (uploadedPhotoPaths.length > 0) {
            await supabase.storage.from('booking-photos').remove(uploadedPhotoPaths);
          }
          showToast('Booking Failed', bErr.message, 'error');
          setIsSubmitting(false);
          return;
        }

        // 2. Insert into public.booking_items
        // Database trigger verify_and_calculate_booking_item verifies rates from materials table
        const itemsPayload = selectedItems.map((item) => ({
          booking_id: newBookingId,
          material_id: item.materialId,
          material_name: item.materialName,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          rate_per_unit: item.ratePerUnit,
          estimated_subtotal: item.estimatedSubtotal,
        }));

        const { error: iErr } = await supabase.from('booking_items').insert(itemsPayload);
        if (iErr) {
          console.warn('Booking items note:', iErr.message);
        }

        const confirmedBooking: Booking = {
          id: newBookingId,
          createdAt: new Date().toISOString(),
          status: 'requested',
          isDemoSample: false,
          materials: selectedItems,
          estimatedTotal,
          address: addressForm,
          assignedDealer: DEMO_DEALER,
          photoPaths: uploadedPhotoPaths,
          photoUrls: photoPreviews,
          statusHistory: [
            {
              status: 'requested',
              timestamp: new Date().toISOString(),
              note: 'Doorstep pickup requested by customer.',
            },
          ],
        };

        saveBooking(confirmedBooking);
        setSubmittedBooking(confirmedBooking);
        showToast('Pickup Scheduled!', `Booking ID ${newBookingId} has been confirmed.`, 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        // Clean up any uploaded photos if upload or preparation failed
        if (uploadedPhotoPaths.length > 0) {
          try {
            await supabase.storage.from('booking-photos').remove(uploadedPhotoPaths);
          } catch {
            // ignore cleanup error
          }
        }
        showToast(
          'Photo Upload / Booking Error',
          err instanceof Error ? err.message : 'An unexpected error occurred while saving booking.',
          'error'
        );
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Local demo fallback
      const newBooking: Booking = {
        id: newBookingId,
        createdAt: new Date().toISOString(),
        status: 'dealer_assigned',
        isDemoSample: false,
        materials: selectedItems,
        estimatedTotal,
        address: addressForm,
        assignedDealer: DEMO_DEALER,
        photoPaths: photoPreviews,
        photoUrls: photoPreviews,
        statusHistory: [
          {
            status: 'requested',
            timestamp: new Date().toISOString(),
            note: 'Doorstep pickup requested by customer.',
          },
          {
            status: 'dealer_assigned',
            timestamp: new Date(Date.now() + 4000).toISOString(),
            note: `Demo partner assigned: ${DEMO_DEALER.name} (${DEMO_DEALER.businessName}).`,
          },
        ],
      };

      saveBooking(newBooking);
      setSubmittedBooking(newBooking);
      showToast('Pickup Scheduled!', `Booking ID ${newBookingId} has been created.`, 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const steps = [
    { id: 1, title: 'Materials', subtitle: 'Select Scrap' },
    { id: 2, title: 'Pickup Details', subtitle: 'Date & Address' },
    { id: 3, title: 'Review', subtitle: 'Confirm & Assign' },
  ];

  // Quick popular add shortcuts from active materials list
  const popularShortcuts = materialsList.filter((m) => m.popular).slice(0, 5);

  // SUCCESS SCREEN
  if (submittedBooking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-white">
        <div className="bg-white/[0.035] backdrop-blur-2xl rounded-3xl p-8 sm:p-10 border border-white/10 shadow-2xl shadow-black/80 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950/50">
            <Check className="w-9 h-9 stroke-[3]" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Demo Request Created
            </span>
            <h1 className="text-3xl font-extrabold text-white">
              Pickup request received!
            </h1>
            <p className="text-sm text-[#9cb1a4] max-w-lg mx-auto">
              Your pickup booking has been recorded and assigned to a verified demo scrap partner.
            </p>
          </div>

          {/* Prototype disclaimer pill */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 text-left flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-amber-300">Frontend Demonstration Notice: </span>
              This is an interactive client-side prototype operating on browser storage. No real pickup truck is dispatched and rates shown are sample benchmarks.
            </div>
          </div>

          {/* Booking Summary Card */}
          <div className="bg-white/[0.03] rounded-2xl p-6 text-left border border-white/[0.08] space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/[0.08] gap-2">
              <div>
                <span className="text-xs text-emerald-300/60">Booking Reference</span>
                <p className="font-extrabold text-lg text-white font-mono">{submittedBooking.id}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-emerald-300/60">Estimated Payout</span>
                <p className="font-black text-xl text-emerald-400">
                  {formatINR(submittedBooking.estimatedTotal)}
                </p>
              </div>
            </div>

            {/* Assigned Demo Dealer Card */}
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold shrink-0">
                  <Truck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-white">
                      {submittedBooking.assignedDealer?.name}
                    </span>
                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-sky-500/15 text-sky-300 border border-sky-500/25">
                      Mock Assigned
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/60">
                    {submittedBooking.assignedDealer?.businessName} • {submittedBooking.assignedDealer?.vehicleType}
                  </p>
                </div>
              </div>
              <div className="text-xs text-[#9cb1a4] sm:text-right">
                <span className="font-bold text-white block">{submittedBooking.address.timeSlot}</span>
                <span>{formatDate(submittedBooking.address.preferredDate)}</span>
              </div>
            </div>

            {/* Address & Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#9cb1a4] pt-1">
              <div>
                <span className="font-bold text-white block mb-1">Pickup Address:</span>
                <p className="font-semibold text-white/90">{submittedBooking.address.fullName}</p>
                <p>{submittedBooking.address.streetAddress}, {submittedBooking.address.area}</p>
                <p>{submittedBooking.address.city} - {submittedBooking.address.pincode}</p>
                <p className="mt-1 font-medium text-emerald-300">Phone: +91 {submittedBooking.address.phoneNumber}</p>
              </div>
              <div>
                <span className="font-bold text-white block mb-1">
                  Scrap Materials ({submittedBooking.materials.length}):
                </span>
                <ul className="space-y-1">
                  {submittedBooking.materials.map((m) => (
                    <li key={m.materialId} className="flex justify-between items-center py-0.5 border-b border-white/[0.06] last:border-b-0">
                      <span>• {m.materialName} ({m.quantity} {m.unit})</span>
                      <span className="font-bold text-white">{formatINR(m.estimatedSubtotal)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {submittedBooking.photoUrls && submittedBooking.photoUrls.length > 0 && (
              <div className="pt-3 border-t border-white/[0.08] space-y-2">
                <span className="font-bold text-white text-xs block">
                  Attached Photos for Dealer Review ({submittedBooking.photoUrls.length}):
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {submittedBooking.photoUrls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Attached scrap ${idx + 1}`}
                      className="w-14 h-14 object-cover rounded-xl border border-white/10 shadow-sm shrink-0"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/bookings"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-lg shadow-emerald-950/60 transition-all active:scale-[0.98]"
            >
              <span>View in My Bookings</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/dealer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all active:scale-[0.98]"
            >
              <span>Inspect in Dealer Portal</span>
            </Link>

            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-white/[0.05] text-white/80 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
            >
              <span>Return Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-white">
      {/* Title */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Book Doorstep Scrap Pickup
        </h1>
        <p className="text-sm text-emerald-200/70 max-w-xl mx-auto">
          Add your scrap items, pick your preferred date and slot, and receive instant doorstep weighing.
        </p>
      </div>

      {/* Stepper with clear visual hierarchy */}
      <Stepper
        steps={steps}
        currentStep={currentStep}
        onStepClick={(s) => setCurrentStep(s)}
      />

      {/* STEP 1: MATERIALS SELECTION */}
      {currentStep === 1 && (
        <div className="bg-white/[0.035] backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6 text-white">
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-white/[0.08] gap-2">
            <div>
              <h2 className="text-xl font-bold text-white">
                Step 1: Select Scrap Materials
              </h2>
              <p className="text-xs text-[#9cb1a4] mt-0.5">
                Start with an empty list and add items you wish to sell with approximate quantities.
              </p>
            </div>
            <Link
              to="/prices"
              target="_blank"
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 transition-colors"
            >
              <span>View full price catalogue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Optional customer photos for dealer review */}
          <CustomerPhotoUpload
            photos={selectedPhotos}
            previews={photoPreviews}
            onAddPhotos={handleAddPhotos}
            onRemovePhoto={handleRemovePhoto}
            onAddDemoPhoto={handleAddDemoPhoto}
            disabled={isSubmitting}
          />

          {/* Quick Add Popular Chips */}
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-emerald-300/60">
              Quick Add Popular Items:
            </span>
            <div className="flex flex-wrap gap-2">
              {popularShortcuts.map((item) => {
                const isAlreadyAdded = selectedItems.some((i) => i.materialId === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddMaterial(item.id)}
                    disabled={isAlreadyAdded}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] ${
                      isAlreadyAdded
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 opacity-70 cursor-not-allowed'
                        : 'bg-white/[0.04] text-white border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.08]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{item.name}</span>
                    <span className="text-emerald-300/50 text-[11px]">
                      ({formatINR(item.indicativeRate)}/{item.unit})
                    </span>
                    {isAlreadyAdded && <span className="font-bold text-emerald-400">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Material Add dropdown selector */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-300/70">
              Add from Complete Catalogue
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedCatalogueId}
                onChange={(e) => setSelectedCatalogueId(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-[#07130c] text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="" className="bg-[#07130c] text-white">-- Choose a material to add --</option>
                {materialsList.map((mat) => {
                  const isAdded = selectedItems.some((i) => i.materialId === mat.id);
                  return (
                    <option key={mat.id} value={mat.id} disabled={isAdded} className="bg-[#07130c] text-white">
                      {mat.name} ({formatINR(mat.indicativeRate)} / {mat.unit}) {isAdded ? '✓ Added' : ''}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={() => handleAddMaterial(selectedCatalogueId)}
                disabled={!selectedCatalogueId}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-md shadow-emerald-950/50"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
            </div>
          </div>

          {/* Validation Error Banner */}
          {materialError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{materialError}</span>
            </div>
          )}

          {/* Selected Materials List */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-300/60">
              Items In Your Pickup Request ({selectedItems.length})
            </h2>

            {selectedItems.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-white/15 rounded-2xl bg-white/[0.02] text-emerald-200/60 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 mx-auto flex items-center justify-center">
                  <Scale className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Your pickup list is empty</h3>
                  <p className="text-xs text-[#9cb1a4] mt-0.5 max-w-sm mx-auto">
                    Select one or more scrap items from the dropdown or quick chips above to get an instant payout estimate.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
                {selectedItems.map((item) => (
                  <div
                    key={item.materialId}
                    className="p-4 bg-white/[0.03] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-base text-white">
                        {item.materialName}
                      </h4>
                      <p className="text-xs text-[#9cb1a4] mt-0.5">
                        Sample rate: <span className="font-semibold text-emerald-400">{formatINR(item.ratePerUnit)}</span> per {item.unit}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Stepper Quantity control */}
                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                        <button
                          type="button"
                          onClick={() => handleDecrement(item.materialId)}
                          disabled={item.quantity <= 1}
                          className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/15 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition-colors"
                          aria-label={`Decrease ${item.materialName} quantity`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="5000"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(item.materialId, parseInt(e.target.value, 10))
                          }
                          className="w-14 text-center text-sm font-bold text-white bg-transparent focus:outline-none"
                          aria-label={`${item.materialName} quantity in ${item.unit}`}
                        />
                        <button
                          type="button"
                          onClick={() => handleIncrement(item.materialId)}
                          className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/15 text-white flex items-center justify-center border border-white/10 transition-colors"
                          aria-label={`Increase ${item.materialName} quantity`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-semibold text-emerald-200/60 pr-1.5">{item.unit}</span>
                      </div>

                      {/* Subtotal */}
                      <div className="w-24 text-right">
                        <span className="text-[10px] text-emerald-300/60 block uppercase font-bold tracking-wider">Subtotal</span>
                        <span className="font-black text-sm text-white">
                          {formatINR(item.estimatedSubtotal)}
                        </span>
                      </div>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.materialId)}
                        className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 rounded-xl transition-colors"
                        title="Remove scrap item"
                        aria-label={`Remove ${item.materialName}`}
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
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-emerald-900/40 to-white/[0.02] border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white">
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                Total Estimated Value
              </span>
              <span className="text-3xl font-black text-white">
                {formatINR(estimatedTotal)}
              </span>
              <span className="text-xs text-emerald-200/70 block mt-0.5">
                (Indicative sample estimate based on your provided weights)
              </span>
            </div>

            <div className="text-xs text-emerald-200/70 max-w-sm sm:text-right bg-white/[0.04] p-3 rounded-xl border border-white/10">
              <span className="font-bold text-white">Estimate Notice: </span>
              Final payout is determined on-site after electronic scale weighing and purity inspection by your assigned dealer.
            </div>
          </div>

          {/* Proceed Button */}
          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={handleProceedToStep2}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-lg shadow-emerald-950/60 transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <span>Continue to Pickup Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PICKUP DETAILS */}
      {currentStep === 2 && (
        <div className="bg-white/[0.035] backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6 text-white">
          <div className="pb-4 border-b border-white/[0.08] flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                Step 2: Pickup Address & Preferred Time Slot
              </h2>
              <p className="text-xs text-[#9cb1a4] mt-0.5">
                Enter your doorstep location and preferred collection window.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to items</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-white mb-1">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300/50" />
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={addressForm.fullName}
                  onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                  className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border bg-white/[0.04] text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 ${
                    formErrors.fullName
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-white/10 focus:ring-emerald-500 focus:border-emerald-500'
                  }`}
                />
              </div>
              {formErrors.fullName && (
                <p className="text-xs text-rose-400 mt-1">{formErrors.fullName}</p>
              )}
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-bold text-white mb-1">
                Mobile Number (for pickup coordination) <span className="text-rose-400">*</span>
              </label>
              <div className="relative flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-white/10 bg-white/[0.06] text-xs font-bold text-emerald-300">
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
                  className={`w-full px-3.5 py-2.5 text-sm rounded-r-xl border bg-white/[0.04] text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 ${
                    formErrors.phoneNumber
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-white/10 focus:ring-emerald-500 focus:border-emerald-500'
                  }`}
                />
              </div>
              {formErrors.phoneNumber && (
                <p className="text-xs text-rose-400 mt-1">{formErrors.phoneNumber}</p>
              )}
            </div>

            {/* Email (Optional) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-white mb-1">
                Email Address <span className="text-emerald-300/50 font-normal">(Optional, for digital receipt)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300/50" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={addressForm.email}
                  onChange={(e) => setAddressForm({ ...addressForm, email: e.target.value })}
                  className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border bg-white/[0.04] text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 ${
                    formErrors.email
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-white/10 focus:ring-emerald-500 focus:border-emerald-500'
                  }`}
                />
              </div>
              {formErrors.email && (
                <p className="text-xs text-rose-400 mt-1">{formErrors.email}</p>
              )}
            </div>

            {/* Street Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-white mb-1">
                Flat / House / Floor / Building Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-emerald-300/50" />
                <textarea
                  rows={2}
                  placeholder="e.g. Flat 304, Green Meadows, 12th Main Road"
                  value={addressForm.streetAddress}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, streetAddress: e.target.value })
                  }
                  className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border bg-white/[0.04] text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 ${
                    formErrors.streetAddress
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-white/10 focus:ring-emerald-500 focus:border-emerald-500'
                  }`}
                />
              </div>
              {formErrors.streetAddress && (
                <p className="text-xs text-rose-400 mt-1">{formErrors.streetAddress}</p>
              )}
            </div>

            {/* Area */}
            <div>
              <label className="block text-xs font-bold text-white mb-1">
                Area / Locality / Sector <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. HSR Layout Sector 2"
                value={addressForm.area}
                onChange={(e) => setAddressForm({ ...addressForm, area: e.target.value })}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white/[0.04] text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 ${
                  formErrors.area
                    ? 'border-rose-400 focus:ring-rose-400'
                    : 'border-white/10 focus:ring-emerald-500 focus:border-emerald-500'
                }`}
              />
              {formErrors.area && <p className="text-xs text-rose-400 mt-1">{formErrors.area}</p>}
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-bold text-white mb-1">
                City <span className="text-rose-400">*</span>
              </label>
              <select
                value={addressForm.city}
                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-white/10 bg-[#07130c] text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {POPULAR_CITIES.map((c) => (
                  <option key={c} value={c} className="bg-[#07130c] text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* PIN Code */}
            <div>
              <label className="block text-xs font-bold text-white mb-1">
                PIN Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="e.g. 560102"
                value={addressForm.pincode}
                onChange={(e) =>
                  setAddressForm({
                    ...addressForm,
                    pincode: e.target.value.replace(/\D/g, ''),
                  })
                }
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white/[0.04] text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 ${
                  formErrors.pincode
                    ? 'border-rose-400 focus:ring-rose-400'
                    : 'border-white/10 focus:ring-emerald-500 focus:border-emerald-500'
                }`}
              />
              {formErrors.pincode && (
                <p className="text-xs text-rose-400 mt-1">{formErrors.pincode}</p>
              )}
            </div>

            {/* Preferred Date */}
            <div>
              <label className="block text-xs font-bold text-white mb-1">
                Preferred Date <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  min={tomorrowStr}
                  value={addressForm.preferredDate}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, preferredDate: e.target.value })
                  }
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white/[0.04] text-white focus:outline-none focus:ring-1 [color-scheme:dark] ${
                    formErrors.preferredDate
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-white/10 focus:ring-emerald-500 focus:border-emerald-500'
                  }`}
                />
              </div>
              {formErrors.preferredDate && (
                <p className="text-xs text-rose-400 mt-1">{formErrors.preferredDate}</p>
              )}
            </div>

            {/* Time Slot selection cards */}
            <div className="sm:col-span-2 space-y-2">
              <label className="block text-xs font-bold text-white">
                Pickup Time Slot <span className="text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TIME_SLOTS.map((slot) => {
                  const isSelected = addressForm.timeSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setAddressForm({ ...addressForm, timeSlot: slot })}
                      className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500 shadow-sm'
                          : 'bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-white/50'}`} />
                        <span>{slot}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Special Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-white mb-1">
                Pickup Notes / Landmark <span className="text-emerald-300/50 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Lift is operational; scrap is packed in boxes near the main gate"
                value={addressForm.notes}
                onChange={(e) => setAddressForm({ ...addressForm, notes: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Materials</span>
            </button>

            <button
              type="button"
              onClick={handleProceedToStep3}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-lg shadow-emerald-950/60 transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <span>Review Booking</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & CONFIRM */}
      {currentStep === 3 && (
        <div className="bg-white/[0.035] backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6 text-white">
          <div className="pb-4 border-b border-white/[0.08] flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                Step 3: Review & Confirm Doorstep Pickup
              </h2>
              <p className="text-xs text-[#9cb1a4] mt-0.5">
                Verify your scrap items, doorstep address, and assigned demo partner.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
          </div>

          {/* Materials Review Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300/60">
              Scrap Items Manifest ({selectedItems.length})
            </h3>
            <div className="border border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-white/[0.06] text-xs">
              {selectedItems.map((m) => (
                <div key={m.materialId} className="p-3.5 flex items-center justify-between bg-white/[0.03]">
                  <div>
                    <span className="font-bold text-sm text-white">{m.materialName}</span>
                    <span className="text-[#9cb1a4] block mt-0.5">
                      Estimated quantity: {m.quantity} {m.unit} @ {formatINR(m.ratePerUnit)}/{m.unit}
                    </span>
                  </div>
                  <span className="font-black text-sm text-white">
                    {formatINR(m.estimatedSubtotal)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Highlight */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-emerald-900/40 to-white/[0.02] border border-emerald-500/30 flex items-center justify-between text-white">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  Indicative Total Payout
                </span>
                <span className="text-xs text-emerald-200/70">
                  Final settlement subject to physical electronic weighing
                </span>
              </div>
              <span className="text-2xl font-black text-white">
                {formatINR(estimatedTotal)}
              </span>
            </div>
          </div>

          {/* Address & Slot Review */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#9cb1a4]">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1">
              <span className="font-bold text-emerald-300/70 text-xs uppercase tracking-wider block mb-1">
                Pickup Address
              </span>
              <p className="font-bold text-sm text-white">{addressForm.fullName}</p>
              <p>{addressForm.streetAddress}</p>
              <p>{addressForm.area}, {addressForm.city} - {addressForm.pincode}</p>
              <p className="pt-1 font-semibold text-emerald-300">Phone: +91 {addressForm.phoneNumber}</p>
              {addressForm.notes && (
                <p className="text-emerald-200/60 italic pt-1">Notes: "{addressForm.notes}"</p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
              <span className="font-bold text-emerald-300/70 text-xs uppercase tracking-wider block mb-1">
                Scheduled Slot & Partner
              </span>
              <p className="flex items-center gap-2 font-bold text-sm text-white">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{formatDate(addressForm.preferredDate)}</span>
              </p>
              <p className="flex items-center gap-2 text-xs text-emerald-200/70">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>{addressForm.timeSlot}</span>
              </p>

              <div className="pt-2 border-t border-white/[0.08] flex items-center gap-2 text-xs text-emerald-200/80">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>
                  Demo Partner: <strong className="text-white">{DEMO_DEALER.name}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Attached Scrap Photos Preview */}
          {photoPreviews.length > 0 && (
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
              <span className="font-bold text-emerald-300/70 text-xs uppercase tracking-wider block">
                Attached Photos for Dealer Review ({photoPreviews.length})
              </span>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {photoPreviews.map((preview, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-sm">
                    <img src={preview} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 py-0.2 rounded font-mono border border-white/10">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notice & Disclaimer Check */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              I understand that displayed scrap prices and estimated payouts are sample indicative benchmarks. Final payout will be weighed and settled via instant UPI or cash on doorstep arrival.
            </p>
          </div>

          {/* Navigation & Confirm */}
          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmBooking}
              disabled={isSubmitting}
              className={`inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-xl shadow-emerald-950/60 transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isSubmitting ? 'Confirming Pickup...' : 'Confirm Pickup Request'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
