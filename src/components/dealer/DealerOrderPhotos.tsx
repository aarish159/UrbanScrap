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


export const DealerOrderPhotos: React.FC<DealerOrderPhotosProps> = ({ booking, materials }) => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // AI analysis state for the currently active photo
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<Record<number, { matches: ScanMatch[]; note: string; isDemo: boolean }>>({});
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [photoLoadError, setPhotoLoadError] = useState<string | null>(null);

  // Load photos (signed URLs for private Supabase Storage, or direct URLs for demo/dataUrls)
  useEffect(() => {
    let isMounted = true;

    async function loadPhotoUrls() {
      setLoadingPhotos(true);
      setPhotoLoadError(null);
      const rawPaths = booking.photoPaths || booking.photoUrls || [];

      if (rawPaths.length === 0) {
        if (isMounted) {
          setPhotos([]);
          setLoadingPhotos(false);
        }
        return;
      }

      const items: PhotoItem[] = [];
      let lastErrorMessage: string | null = null;

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
              lastErrorMessage = error?.message || 'Storage permission or signed URL failure';
            } else {
              items.push({
                id: `photo-${i}`,
                url: data.signedUrl,
                originalPath: cleanPath,
                isDemo: false,
              });
            }
          } catch (err: any) {
            console.error('Signed URL exception:', err);
            lastErrorMessage = err?.message || 'Network exception while accessing private storage';
          }
        }
      }

      if (isMounted) {
        setPhotos(items);
        if (items.length === 0 && rawPaths.length > 0) {
          setPhotoLoadError(lastErrorMessage || 'Failed to generate signed URLs for attached photos.');
        }
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

  // Handler to analyze the customer photo using scrap-scan Edge Function
  const handleAnalyzePhoto = async () => {
    if (!activePhoto) return;
    setAnalysisError(null);
    setIsAnalyzing(true);

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
      let dataUrl: string;
      if (activePhoto.url.startsWith('data:image/')) {
        dataUrl = activePhoto.url;
      } else {
        const imgRes = await fetch(activePhoto.url);
        if (!imgRes.ok) {
          throw new Error('Unable to download customer photo for scanning. Please check your network connection.');
        }
        const blob = await imgRes.blob();
        const tempFile = new File([blob], 'scrap.jpg', { type: blob.type || 'image/jpeg' });
        const compressed = await compressImageFile(tempFile);
        dataUrl = compressed.dataUrl;
      }

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
        let serverCode = '';
        try {
          if ('context' in invokeError && typeof (invokeError as any).context?.json === 'function') {
            const errBody = await (invokeError as any).context.json();
            if (errBody?.error && typeof errBody.error === 'string') {
              serverMessage = errBody.error;
            }
            if (errBody?.code && typeof errBody.code === 'string') {
              serverCode = errBody.code;
            }
          }
        } catch {
          // ignore parsing error
        }

        if (serverCode === 'OPENAI_QUOTA_EXCEEDED' || serverMessage.toLowerCase().includes('quota')) {
          throw new Error('AI scanner quota exceeded on server. Please inspect and confirm materials manually from the catalogue below.');
        }

        if (serverCode === 'OPENAI_CONFIGURATION_ERROR' || serverMessage.toLowerCase().includes('configuration') || serverMessage.toLowerCase().includes('not configured')) {
          throw new Error('AI scanner configuration notice: OpenAI API key is missing or unconfigured in Supabase secrets. Please inspect materials manually.');
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
          note: typeof data?.note === 'string' && data.note
            ? data.note
            : 'AI estimate note: Visual scrap identification can be inaccurate. Actual material categories, condition, and certified weight will be verified on-site during pickup.',
          isDemo: false,
        },
      }));
    } catch (err: any) {
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
      <div className="p-4 rounded-2xl glass-panel border border-white/10 text-xs text-[#9cb1a4] flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <span>Loading attached customer scrap photos...</span>
      </div>
    );
  }

  // Case: Photo loading failed
  if (photoLoadError) {
    return (
      <div className="p-4 rounded-2xl glass-panel border border-rose-500/30 bg-rose-500/10 flex items-start gap-3 text-xs text-rose-200">
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-white block">Customer Photos Attached</span>
          <p className="text-rose-200/90 leading-relaxed">
            Unable to load attached customer photos: {photoLoadError}. Booking details and scheduled pickup info remain fully available.
          </p>
        </div>
      </div>
    );
  }

  // Case: No photos attached by customer
  if (photos.length === 0) {
    return (
      <div className="p-4 rounded-2xl glass-panel border border-white/10 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] text-emerald-400 border border-white/10 flex items-center justify-center shrink-0">
          <Camera className="w-4 h-4" />
        </div>
        <div className="text-xs space-y-0.5">
          <span className="font-bold text-white block">No photos attached</span>
          <p className="text-[#9cb1a4]">
            No photos attached by customer. The customer manually selected materials from the catalogue. You can inspect and weigh items directly during doorstep pickup.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl glass-card border border-white/[0.08] shadow-xl space-y-4 text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/[0.06] gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center">
            <Camera className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white">
              Customer Scrap Photos ({photos.length})
            </h4>
            <span className="text-[11px] text-[#9cb1a4]">
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
                    ? 'border-emerald-400 ring-2 ring-emerald-500/30'
                    : 'border-white/15 opacity-60 hover:opacity-100'
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
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-4/3 max-h-64 sm:max-h-72">
              <img
                src={activePhoto.url}
                alt="Customer scrap"
                className="w-full h-full object-contain bg-black/60"
              />
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <span className="bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10">
                  Photo {activePhotoIndex + 1} of {photos.length}
                </span>
                {activePhoto.isDemo && (
                  <span className="bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    Demo Photo
                  </span>
                )}
              </div>
              <a
                href={activePhoto.url}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-2 right-2 bg-black/75 hover:bg-black text-white p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors border border-white/10"
                title="Open full image in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <p className="text-[11px] text-[#9cb1a4] text-center">
              Click photo to enlarge. Photos are stored securely in encrypted private storage.
            </p>
          </div>

          {/* Analysis & Suggestions Panel */}
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  AI Material Assistance
                </span>

                <button
                  type="button"
                  onClick={handleAnalyzePhoto}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-[#07130c] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[#07130c] border-t-transparent rounded-full animate-spin" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <ScanSearch className="w-3.5 h-3.5 text-[#07130c]" />
                      <span>{currentResult ? 'Re-scan Scrap' : 'Scan Scrap'}</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-[#9cb1a4] leading-relaxed">
                Scan this customer photo to identify likely materials from your active catalogue before heading to the pickup address.
              </p>
            </div>

            {/* Error Message */}
            {analysisError && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Scanner Notice</span>
                </div>
                <p className="leading-relaxed">{analysisError}</p>
                <div className="pt-1 border-t border-amber-500/20 text-[11px] text-amber-100/70">
                  Tip: You can manually review materials directly from the catalogue and verify all scrap on-site with certified digital scales.
                </div>
              </div>
            )}

            {/* Analysis Results Display */}
            {currentResult && (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      AI Estimate: Suggested Catalogue Matches
                    </span>
                  </div>
                  {currentResult.isDemo && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Demo Result (Illustrative)
                    </span>
                  )}
                </div>

                {currentResult.matches.length > 0 ? (
                  <div className="space-y-2">
                    {currentResult.matches.map((match, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10 space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span>{match.materialName}</span>
                          <span className="text-[11px] font-semibold text-emerald-400">
                            {Math.round(match.confidence * 100)}% match
                          </span>
                        </div>
                        {match.reason && (
                          <p className="text-[11px] text-[#9cb1a4] leading-relaxed">
                            {match.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#9cb1a4]">
                    No specific catalogue materials clearly matched this image.
                  </p>
                )}

                {currentResult.note && (
                  <p className="text-[11px] text-[#9cb1a4] italic border-t border-white/10 pt-2">
                    {currentResult.note}
                  </p>
                )}
              </div>
            )}

            {/* Crucial Dealer Advisory Disclaimer */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-[11px] text-[#9cb1a4] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Scale className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
