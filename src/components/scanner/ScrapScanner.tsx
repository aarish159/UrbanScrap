import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, ImagePlus, LoaderCircle, ScanSearch, Sparkles } from 'lucide-react';
import type { Material } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [matches, setMatches] = useState<ScanMatch[]>([]);
  const [scanNote, setScanNote] = useState('');
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const matchDetails = useMemo(
    () => matches.flatMap((match) => {
      const material = materials.find((item) => item.id === match.materialId);
      return material ? [{ ...match, material }] : [];
    }),
    [matches, materials]
  );

  const handleFile = (nextFile?: File) => {
    setError('');
    setMatches([]);
    setScanNote('');
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

  const handleScan = async () => {
    if (!file) {
      setError('Take or choose a photo of the scrap first.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('The scanner is unavailable because the app is not connected to Supabase.');
      return;
    }
    setError('');
    setIsScanning(true);
    try {
      const imageDataUrl = await compressPhoto(file);
      const { data, error: invokeError } = await supabase.functions.invoke('scrap-scan', {
        body: {
          imageDataUrl,
          materials: materials.map(({ id, name, category, unit }) => ({ id, name, category, unit })),
        },
      });
      if (invokeError) throw new Error(invokeError.message || 'The scan could not be completed.');
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
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
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
            </div>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#58645d]">
              Take a clear photo and get likely material matches from our catalogue. Review the suggestions and add what you want to sell.
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
            {file ? <ImagePlus className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {file ? 'Change photo' : 'Take / choose photo'}
          </button>
          <button
            type="button"
            onClick={handleScan}
            disabled={!file || isScanning}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#12813b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isScanning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            {isScanning ? 'Scanning…' : 'Scan scrap'}
          </button>
        </div>
      </div>

      {file && (
        <div className="grid gap-4 border-t border-emerald-100 bg-white/70 p-4 sm:grid-cols-[140px_1fr] sm:p-5">
          <img src={previewUrl} alt="Selected scrap for identification" className="h-32 w-full rounded-xl border border-[#e2e8e3] bg-[#f8faf9] object-cover sm:w-36" />
          <div className="min-w-0 space-y-3">
            {isScanning && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-900" role="status">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Looking for visible materials in your photo…
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
              </div>
            )}
            {scanNote && !isScanning && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{scanNote}
              </div>
            )}
            {matchDetails.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-[#123b26]">Possible matches — confirm before adding:</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {matchDetails.map(({ material, confidence, reason }) => {
                    const alreadyAdded = selectedMaterialIds.includes(material.id);
                    return (
                      <div key={material.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e2e8e3] bg-white p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-bold text-[#123b26]">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="truncate">{material.name}</span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-[#68736d]">{reason}</p>
                          <p className="mt-1 text-[10px] font-semibold text-[#16804a]">{Math.round(confidence * 100)}% visual confidence · indicative {material.indicativeRate}/{material.unit}</p>
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
        AI suggestions may be wrong and do not determine weight, quality, or final payout. Your photo is sent securely for analysis and is not saved by this feature. Confirm materials and enter approximate quantities below; the dealer weighs and confirms them at pickup.
      </div>
    </section>
  );
};
