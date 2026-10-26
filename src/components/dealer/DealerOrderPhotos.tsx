import React, { useState, useEffect } from 'react';
import {
  Camera,
  ScanSearch,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Scale,
  ExternalLink,
} from 'lucide-react';
import type { Booking, Material } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { compressImageFile } from '../../utils/imageUtils';

interface DealerOrderPhotosProps {
  booking: Booking;
  materials: Material[];
}

interface ScanMatch {
  materialId: string;
  materialName: string;
  category: string;
  confidence: number;
  reason?: string;
}

interface PhotoItem {
  id: string;
  url: string;
  originalPath: string;
  isDemo: boolean;
}

const DEMO_PRESET_MATCHES: Record<string, { matches: ScanMatch[]; note: string }> = {
  cardboard: {
    matches: [
      {
        materialId: 'mat-cardboard',
        materialName: 'Cardboard / Corrugated Boxes',
        category: 'paper',
        confidence: 0.94,
        reason: 'Clean corrugated kraft board sheets, dry and unsoiled packaging boxes.',
      },
      {
        materialId: 'mat-newspaper',
        materialName: 'Newspaper (Raddi)',
        category: 'paper',
        confidence: 0.72,
        reason: 'Discarded printed paper inserts and packaging liners visible nearby.',
      },
    ],
    note: 'Demo sample result: Detected packaging corrugated cardboard and paper bundles. Live AI recognition was not invoked.',
  },
  metal: {
    matches: [
      {
        materialId: 'mat-iron',
        materialName: 'Iron Scrap (Loha)',
        category: 'metal',
        confidence: 0.91,
        reason: 'Heavy structural ferrous metal elements and metallic fabrication offcuts.',
      },
      {
        materialId: 'mat-aluminium',
        materialName: 'Aluminium Scrap',
        category: 'metal',
        confidence: 0.68,
        reason: 'Lightweight cast or extruded framing sections visible in scrap pile.',
      },
    ],
    note: 'Demo sample result: Identified ferrous structural metal scrap. Live AI recognition was not invoked.',
  },
  sample: {
    matches: [
      {
        materialId: 'mat-copper',
        materialName: 'Copper Wire & Piping',
        category: 'metal',
        confidence: 0.88,
        reason: 'Bright stripped red-metal wiring coils and plumbing pipe segments.',
      },
      {
        materialId: 'mat-brass',
        materialName: 'Brass Scrap (Peetal)',
        category: 'metal',
        confidence: 0.74,
        reason: 'Machined yellow-metal plumbing fittings and valves.',
      },
    ],
    note: 'Demo sample result: Identified non-ferrous electrical/plumbing scrap. Live AI recognition was not invoked.',
  },
};

export const DealerOrderPhotos: React.FC<DealerOrderPhotosProps> = ({ booking, materials }) => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // AI analysis state for the currently active photo
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<Record<number, { matches: ScanMatch[]; note: string; isDemo: boolean }>>({});
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Load photos (signed URLs for private Supabase Storage, or direct URLs for demo/dataUrls)
  useEffect(() => {
    let isMounted = true;

    async function loadPhotoUrls() {
      setLoadingPhotos(true);
      const rawPaths = booking.photoPaths || booking.photoUrls || [];

      if (rawPaths.length === 0) {
        if (isMounted) {
          setPhotos([]);
          setLoadingPhotos(false);
        }
        return;
      }

      const items: PhotoItem[] = [];

      for (let i = 0; i < rawPaths.length; i++) {
        const path = rawPaths[i];
        const isDemo = path.includes('/demo/') || path.startsWith('data:') || !!booking.isDemoSample;

        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('/demo/')) {
          items.push({
            id: `photo-${i}`,
            url: path,
            originalPath: path,
            isDemo,
          });
        } else if (isSupabaseConfigured()) {
          try {
            // Private bucket: create a short-lived signed URL using bucket-relative path
            const cleanPath = path.replace(/^booking-photos\//, '').replace(/^\//, '');
            const { data, error } = await supabase.storage
              .from('booking-photos')
              .createSignedUrl(cleanPath, 3600);

            if (error || !data?.signedUrl) {
              console.warn(`Could not resolve signed URL for photo ${cleanPath}:`, error?.message);
            } else {
              items.push({
                id: `photo-${i}`,
                url: data.signedUrl,
                originalPath: cleanPath,
                isDemo: false,
              });
            }
          } catch (err) {
            console.error('Signed URL exception:', err);
          }
        }
      }

      if (isMounted) {
        setPhotos(items);
        setActivePhotoIndex(0);
        setLoadingPhotos(false);
      }
    }

    loadPhotoUrls();

    return () => {
      isMounted = false;
    };
  }, [booking.id, booking.photoPaths, booking.photoUrls, booking.isDemoSample]);

  const activePhoto = photos[activePhotoIndex];
  const currentResult = analysisResults[activePhotoIndex];

  // Handler to analyze the current photo
  const handleAnalyzePhoto = async () => {
    if (!activePhoto) return;
    setAnalysisError(null);
    setIsAnalyzing(true);

    // 1. Check for Demo Photo
    if (activePhoto.isDemo || booking.isDemoSample) {
      await new Promise((r) => setTimeout(r, 650)); // Realistic UX delay

      let preset = DEMO_PRESET_MATCHES.sample;
      if (activePhoto.originalPath.toLowerCase().includes('cardboard')) {
        preset = DEMO_PRESET_MATCHES.cardboard;
      } else if (activePhoto.originalPath.toLowerCase().includes('metal')) {
        preset = DEMO_PRESET_MATCHES.metal;
      }

      setAnalysisResults((prev) => ({
        ...prev,
        [activePhotoIndex]: {
          matches: preset.matches,
          note: preset.note,
          isDemo: true,
        },
      }));
      setIsAnalyzing(false);
      return;
    }

    // 2. Real Photo AI Analysis via scrap-scan Edge Function
    if (!isSupabaseConfigured()) {
      setAnalysisError('AI analysis unavailable: Supabase client is not configured.');
      setIsAnalyzing(false);
      return;
    }

    try {
      // Obtain active dealer session token
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (sessionErr || !accessToken) {
        setAnalysisError('Please sign in with your dealer account to analyze customer photos.');
        setIsAnalyzing(false);
        return;
      }

      // Fetch the photo through signed URL, compress and convert to base64 data URL
      const imgRes = await fetch(activePhoto.url);
      if (!imgRes.ok) {
        throw new Error('Unable to download photo for scanning. Please check your network connection.');
      }
      const blob = await imgRes.blob();
      const tempFile = new File([blob], 'scrap.jpg', { type: blob.type || 'image/jpeg' });
      const { dataUrl } = await compressImageFile(tempFile);

      // Invoke scrap-scan Edge Function with explicit authorization header
      const { data, error: invokeError } = await supabase.functions.invoke('scrap-scan', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          imageDataUrl: dataUrl,
          materials: materials.map(({ id, name, category, unit }) => ({ id, name, category, unit })),
        },
      });

      if (invokeError) {
        let serverMessage = '';
        try {
          if ('context' in invokeError && typeof (invokeError as any).context?.json === 'function') {
            const errBody = await (invokeError as any).context.json();
            if (errBody?.error && typeof errBody.error === 'string') {
              serverMessage = errBody.error;
            }
          }
        } catch {
          // ignore parsing error
        }
        throw new Error(serverMessage || invokeError.message || 'The photo analysis could not be completed.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setAnalysisResults((prev) => ({
        ...prev,
        [activePhotoIndex]: {
          matches: Array.isArray(data?.matches) ? data.matches : [],
          note: typeof data?.note === 'string' ? data.note : '',
          isDemo: false,
        },
      }));
    } catch (err) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : 'Photo analysis could not be completed. You can still inspect scrap manually at pickup.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loadingPhotos) {
    return (
      <div className="p-4 rounded-2xl bg-[#f8faf9] border border-[#e2e4e1] text-xs text-[#717a75] flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-[#16a34a] border-t-transparent rounded-full animate-spin" />
        <span>Loading attached customer scrap photos...</span>
      </div>
    );
  }

  // Case: No photos attached by customer
  if (photos.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-[#f8faf9] border border-[#e2e4e1] flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
          <Camera className="w-4 h-4" />
        </div>
        <div className="text-xs space-y-0.5">
          <span className="font-bold text-[#123b26] block">Customer Scrap Photos</span>
          <p className="text-[#717a75]">
            No photos attached by customer. The customer manually selected materials from the catalogue. You can inspect and weigh items directly during doorstep pickup.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-white border border-[#e2e4e1] shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#f1f3f1] gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#123b26] flex items-center justify-center">
            <Camera className="w-4 h-4 text-[#16a34a]" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-[#123b26]">
              Customer Scrap Photos ({photos.length})
            </h4>
            <span className="text-[11px] text-[#717a75]">
              Attached by customer for pre-pickup review
            </span>
          </div>
        </div>

        {/* Thumbnail Selector if multiple photos */}
        {photos.length > 1 && (
          <div className="flex items-center gap-1.5">
            {photos.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActivePhotoIndex(idx);
                  setAnalysisError(null);
                }}
                className={`w-9 h-9 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === activePhotoIndex
                    ? 'border-[#16a34a] ring-2 ring-emerald-200'
                    : 'border-[#d1d5db] opacity-70 hover:opacity-100'
                }`}
              >
                <img src={p.url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Photo & Action Area */}
      {activePhoto && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Photo Display Card */}
          <div className="space-y-2">
            <div className="relative rounded-xl overflow-hidden border border-[#d1d5db] bg-black/5 aspect-4/3 max-h-64 sm:max-h-72">
              <img
                src={activePhoto.url}
                alt="Customer scrap"
                className="w-full h-full object-contain bg-slate-900"
              />
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <span className="bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                  Photo {activePhotoIndex + 1} of {photos.length}
                </span>
                {activePhoto.isDemo && (
                  <span className="bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Demo Photo
                  </span>
                )}
              </div>
              <a
                href={activePhoto.url}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
                title="Open full image in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <p className="text-[11px] text-[#717a75] text-center">
              Click photo to enlarge. Photos are stored securely in encrypted private storage.
            </p>
          </div>

          {/* Analysis & Suggestions Panel */}
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#e2e4e1] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#123b26] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#16a34a]" />
                  AI Material Assistance
                </span>

                <button
                  type="button"
                  onClick={handleAnalyzePhoto}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#123b26] text-white hover:bg-[#1a5336] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <ScanSearch className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{currentResult ? 'Re-scan Photo' : 'Scan Customer Photo'}</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-[#525955] leading-relaxed">
                Analyze this photo to identify likely materials from your active catalogue before heading to the pickup address.
              </p>
            </div>

            {/* Error Message */}
            {analysisError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>AI Analysis Note</span>
                </div>
                <p className="leading-relaxed">{analysisError}</p>
              </div>
            )}

            {/* Analysis Results Display */}
            {currentResult && (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                    <span className="text-xs font-bold text-[#123b26]">
                      Suggested Catalogue Matches
                    </span>
                  </div>
                  {currentResult.isDemo && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                      Demo Result (Illustrative)
                    </span>
                  )}
                </div>

                {currentResult.matches.length > 0 ? (
                  <div className="space-y-2">
                    {currentResult.matches.map((match, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-white border border-emerald-100 space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-[#123b26]">
                          <span>{match.materialName}</span>
                          <span className="text-[11px] font-semibold text-[#16a34a]">
                            {Math.round(match.confidence * 100)}% match
                          </span>
                        </div>
                        {match.reason && (
                          <p className="text-[11px] text-[#525955] leading-relaxed">
                            {match.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#525955]">
                    No specific catalogue materials clearly matched this image.
                  </p>
                )}

                {currentResult.note && (
                  <p className="text-[11px] text-[#525955] italic border-t border-emerald-200/60 pt-2">
                    {currentResult.note}
                  </p>
                )}
              </div>
            )}

            {/* Crucial Dealer Advisory Disclaimer */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Scale className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>Verification Advisory</span>
              </div>
              <p className="leading-relaxed">
                Photos and AI suggestions are indicative suggestions for pre-pickup planning. Weight, purity, material grading, and final payout must be confirmed on-site via certified digital weighing.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
