import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, ImagePlus, LoaderCircle, ScanSearch, Sparkles } from 'lucide-react';
import type { Material } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ScanMatch {
  materialId: string;
  confidence: number;
  reason: string;
}

interface ScrapScannerProps {
  materials: Material[];
  onAddMaterial: (materialId: string) => void;
  selectedMaterialIds: string[];
}

type DemoSampleId = 'metal' | 'cardboard';

interface DemoSampleConfig {
  id: DemoSampleId;
  label: string;
  badgeLabel: string;
  imagePath: string;
  filename: string;
  matches: Array<{
    materialId: string;
    confidence: number;
    reason: string;
  }>;
  note: string;
}

const DEMO_SAMPLES: Record<DemoSampleId, DemoSampleConfig> = {
  metal: {
    id: 'metal',
    label: 'Metal Scrap (Aluminium & Copper)',
    badgeLabel: 'Metal Sample',
    imagePath: '/demo/scrap-metal.jpg',
    filename: 'scrap-metal.jpg',
    matches: [
      {
        materialId: 'mat-aluminium',
        confidence: 0.92,
        reason: 'Illustrative demo: Discarded aluminium beverage cans, containers, and light alloy parts evident in pile.',
      },
      {
        materialId: 'mat-copper',
        confidence: 0.88,
        reason: 'Illustrative demo: Coiled copper electrical wire bundles and motor wiring visible in foreground.',
      },
      {
        materialId: 'mat-iron',
        confidence: 0.74,
        reason: 'Illustrative demo: Assorted ferrous structural brackets, hardware parts, and scrap pipes in the background.',
      },
    ],
    note: 'Demo sample result: Identified metal materials for offline academic demonstration. Live AI recognition was not invoked.',
  },
  cardboard: {
    id: 'cardboard',
    label: 'Cardboard & Paper Scrap',
    badgeLabel: 'Cardboard Sample',
    imagePath: '/demo/scrap-cardboard.jpg',
    filename: 'scrap-cardboard.jpg',
    matches: [
      {
        materialId: 'mat-cardboard',
        confidence: 0.95,
        reason: 'Illustrative demo: Large volume of flattened corrugated brown shipping cartons and packing boxes.',
      },
      {
        materialId: 'mat-newspaper',
        confidence: 0.72,
        reason: 'Illustrative demo: Discarded printed paper liners, inserts, and packaging newsprint.',
      },
    ],
    note: 'Demo sample result: Identified paper & cardboard materials for offline academic demonstration. Live AI recognition was not invoked.',
  },
};

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1280;

function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Your browser could not prepare this photo.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This photo could not be opened. Try a JPG or PNG image.'));
    };
    image.src = objectUrl;
  });
}

export const ScrapScanner: React.FC<ScrapScannerProps> = ({ materials, onAddMaterial, selectedMaterialIds }) => {
  const { openAuthModal } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [matches, setMatches] = useState<ScanMatch[]>([]);
  const [scanNote, setScanNote] = useState('');
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [activeDemoSample, setActiveDemoSample] = useState<DemoSampleId | null>(null);
  const [isDemoResult, setIsDemoResult] = useState<boolean>(false);

  useEffect(() => () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  const matchDetails = useMemo(
    () =>
      matches.flatMap((match) => {
        const material = materials.find((item) => item.id === match.materialId);
        return material ? [{ ...match, material }] : [];
      }),
    [matches, materials]
  );

  const handleFile = (nextFile?: File) => {
    setError('');
    setMatches([]);
    setScanNote('');
    setActiveDemoSample(null);
    setIsDemoResult(false);
    if (!nextFile) return;
    if (!nextFile.type.startsWith('image/')) {
      setError('Choose an image file to scan.');
      return;
    }
    if (nextFile.size > MAX_PHOTO_BYTES) {
      setError('Choose a photo smaller than 8 MB.');
      return;
    }
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const handleLoadDemo = async (sampleId: DemoSampleId) => {
    setError('');
    setMatches([]);
    setScanNote('');
    setIsDemoResult(false);
    const sample = DEMO_SAMPLES[sampleId];
    try {
      const response = await fetch(sample.imagePath);
      if (!response.ok) throw new Error('Demo photo could not be loaded.');
      const blob = await response.blob();
      const demoFile = new File([blob], sample.filename, { type: blob.type || 'image/jpeg' });
      setFile(demoFile);
      setPreviewUrl(sample.imagePath);
      setActiveDemoSample(sampleId);
    } catch {
      setError('Failed to load demo image.');
    }
  };

  const handleScan = async () => {
    if (!file) {
      setError('Take or choose a photo of the scrap first.');
      return;
    }

    setError('');

    // Dedicated Demo Path: Reliable offline demonstration without consuming API credits
    if (activeDemoSample) {
      setIsScanning(true);
      setIsDemoResult(true);

      // Brief simulated scanning delay for realistic UX demonstration
      await new Promise((resolve) => setTimeout(resolve, 600));

      const sample = DEMO_SAMPLES[activeDemoSample];
      const availableIds = new Set(materials.map((m) => m.id));
      const validMatches = sample.matches.filter((m) => availableIds.has(m.materialId));

      setMatches(validMatches);
      setScanNote(sample.note);
      setIsScanning(false);
      return;
    }

    // Live AI Recognition Path (requires Supabase connection & authenticated user)
    if (!isSupabaseConfigured()) {
      setError('The live scanner is unavailable because the app is not connected to Supabase.');
      return;
    }

    // 1. Obtain current access token from existing Supabase client session immediately before invoking scrap-scan
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    // 2. If no session/access token exists, show a clear sign-in message and do not invoke the function
    if (sessionError || !accessToken) {
      setError('Please sign in to use the scrap photo scanner.');
      openAuthModal({
        initialRole: 'customer',
        reasonMessage: 'Please sign in to use the scrap photo scanner.',
      });
      return;
    }

    setIsScanning(true);
    setIsDemoResult(false);
    try {
      const imageDataUrl = await compressPhoto(file);
      // 3. Pass token explicitly as Authorization: Bearer <access_token> in the supabase.functions.invoke headers
      const { data, error: invokeError } = await supabase.functions.invoke('scrap-scan', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          imageDataUrl,
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
        throw new Error(serverMessage || invokeError.message || 'The scan could not be completed.');
      }

      if (data?.error) throw new Error(data.error);

      setMatches(Array.isArray(data?.matches) ? data.matches : []);
      setScanNote(typeof data?.note === 'string' ? data.note : '');
      if (!Array.isArray(data?.matches) || data.matches.length === 0) {
        setScanNote(data?.note || 'No clear match found. You can still choose materials from the catalogue below.');
      }
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'The scan could not be completed. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-[#f1fbf4] via-white to-[#eef7ff]">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#123b26] text-emerald-300 shadow-sm">
              <ScanSearch className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-[#123b26]">Identify scrap with a photo</h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                  <Sparkles className="h-3 w-3" /> AI assist
                </span>
                {activeDemoSample && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                    Demo Mode Active
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#58645d]">
                Take a photo or load a sample to suggest likely material matches from our catalogue. Review the suggestions and add what you want to sell.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cbd5cf] bg-white px-3.5 py-2.5 text-xs font-bold text-[#123b26] transition hover:border-emerald-400 hover:bg-emerald-50"
            >
              {file && !activeDemoSample ? <ImagePlus className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {file && !activeDemoSample ? 'Change photo' : 'Take / choose photo'}
            </button>
            <button
              type="button"
              onClick={handleScan}
              disabled={!file || isScanning}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                activeDemoSample ? 'bg-[#d97706] hover:bg-[#b45309]' : 'bg-[#16a34a] hover:bg-[#12813b]'
              }`}
            >
              {isScanning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              {isScanning ? 'Scanning…' : activeDemoSample ? 'Scan demo scrap' : 'Scan scrap'}
            </button>
          </div>
        </div>

        {/* Demo Samples Toolbar */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/50 p-2.5 sm:px-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Load demo photo (no API cost):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleLoadDemo('metal')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                activeDemoSample === 'metal'
                  ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                  : 'border-amber-300 bg-white text-amber-900 hover:bg-amber-100 hover:border-amber-400'
              }`}
            >
              <span>Metal Sample (Aluminium & Copper)</span>
            </button>
            <button
              type="button"
              onClick={() => handleLoadDemo('cardboard')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                activeDemoSample === 'cardboard'
                  ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                  : 'border-amber-300 bg-white text-amber-900 hover:bg-amber-100 hover:border-amber-400'
              }`}
            >
              <span>Cardboard & Paper Sample</span>
            </button>
          </div>
        </div>
      </div>

      {file && (
        <div className="grid gap-4 border-t border-emerald-100 bg-white/70 p-4 sm:grid-cols-[140px_1fr] sm:p-5">
          <div className="relative">
            <img
              src={previewUrl}
              alt={activeDemoSample ? `Demo scrap: ${DEMO_SAMPLES[activeDemoSample].label}` : 'Selected scrap for identification'}
              className="h-32 w-full rounded-xl border border-[#e2e8e3] bg-[#f8faf9] object-cover sm:w-36"
            />
            {activeDemoSample && (
              <span className="absolute bottom-2 left-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 backdrop-blur-xs">
                Demo Sample
              </span>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            {activeDemoSample && !isScanning && matches.length === 0 && !error && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <span className="font-bold">Loaded {DEMO_SAMPLES[activeDemoSample].label} (Offline Demo).</span>
                  <p className="mt-0.5 text-[11px] text-amber-800">
                    Click <strong>“Scan demo scrap”</strong> above to demonstrate the material classification and booking flow without live OpenAI API credits.
                  </p>
                </div>
              </div>
            )}

            {isScanning && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-900" role="status">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {activeDemoSample ? 'Evaluating demo scrap sample photo…' : 'Looking for visible materials in your photo…'}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <span>{error}</span>
                  {error.toLowerCase().includes('sign in') && (
                    <button
                      type="button"
                      onClick={() => openAuthModal({ initialRole: 'customer', reasonMessage: 'Please sign in to use the scrap photo scanner.' })}
                      className="ml-2 font-bold underline hover:text-rose-950"
                    >
                      Sign in now
                    </button>
                  )}
                </div>
              </div>
            )}

            {scanNote && !isScanning && (
              <div
                className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
                  isDemoResult ? 'border border-amber-200 bg-amber-50 text-amber-950' : 'bg-amber-50 text-amber-900'
                }`}
              >
                <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${isDemoResult ? 'text-amber-600' : 'text-amber-700'}`} />
                <div>{scanNote}</div>
              </div>
            )}

            {matchDetails.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#123b26]">
                    {isDemoResult ? 'Demo sample matches — illustrative suggestions for evaluation:' : 'Possible matches — confirm before adding:'}
                  </p>
                  {isDemoResult && (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      Illustrative Demo Results
                    </span>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {matchDetails.map(({ material, confidence, reason }) => {
                    const alreadyAdded = selectedMaterialIds.includes(material.id);
                    return (
                      <div key={material.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e2e8e3] bg-white p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-bold text-[#123b26]">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="truncate">{material.name}</span>
                            {isDemoResult && (
                              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">
                                Demo
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-[#68736d]">{reason}</p>
                          <p className="mt-1 text-[10px] font-semibold text-[#16804a]">
                            {Math.round(confidence * 100)}% {isDemoResult ? 'illustrative visual confidence (Demo)' : 'visual confidence'} · indicative {material.indicativeRate}/{material.unit}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => onAddMaterial(material.id)}
                          className="shrink-0 rounded-lg bg-[#123b26] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#16a34a] disabled:opacity-50"
                        >
                          {alreadyAdded ? 'Added' : 'Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 border-t border-emerald-100 px-4 py-3 text-[10px] leading-relaxed text-[#68736d] sm:px-5">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
        <div>
          {isDemoResult ? (
            <span className="font-semibold text-amber-900">
              Demo sample active: Results are fixed illustrative catalogue suggestions for academic demonstration and do not use live OpenAI API credits.{' '}
            </span>
          ) : (
            'AI suggestions may be wrong and do not determine weight, quality, or final payout. Your photo is sent securely for analysis and is not saved by this feature. '
          )}
          Confirm materials and enter approximate quantities below; the dealer weighs and confirms them at pickup.
        </div>
      </div>
    </section>
  );
};
