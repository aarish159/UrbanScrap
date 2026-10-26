import React, { useRef, useState } from 'react';
import { Camera, Trash2, Plus, AlertCircle, Info, Sparkles } from 'lucide-react';
import { validateImageFile, MAX_PHOTO_COUNT } from '../../utils/imageUtils';

interface CustomerPhotoUploadProps {
  photos: File[];
  previews: string[];
  onAddPhotos: (newFiles: File[]) => void;
  onRemovePhoto: (index: number) => void;
  onAddDemoPhoto: () => void;
  maxPhotos?: number;
  disabled?: boolean;
}

export const CustomerPhotoUpload: React.FC<CustomerPhotoUploadProps> = ({
  photos,
  previews,
  onAddPhotos,
  onRemovePhoto,
  onAddDemoPhoto,
  maxPhotos = MAX_PHOTO_COUNT,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (photos.length + selectedFiles.length > maxPhotos) {
      setError(`You can attach up to ${maxPhotos} photos in total.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const validFiles: File[] = [];
    for (const file of selectedFiles) {
      const valErr = validateImageFile(file);
      if (valErr) {
        setError(valErr);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onAddPhotos(validFiles);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-5 rounded-2xl bg-white/[0.035] backdrop-blur-xl border border-white/[0.08] space-y-4 text-white">
      {/* Header with Title and Disclaimer */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 flex items-center justify-center">
              <Camera className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Add photos for your dealer <span className="font-normal text-emerald-300/60">(Optional)</span>
              </h3>
              <span className="text-[11px] text-emerald-300/60">
                {photos.length} of {maxPhotos} photos added
              </span>
            </div>
          </div>
          <p className="text-xs text-[#9cb1a4] leading-relaxed pt-1">
            Photos help your dealer review the request. Material, weight, quality, and payout are confirmed by the dealer at pickup.
          </p>
        </div>

        {/* Action button to load a sample for quick demo testing */}
        {photos.length < maxPhotos && !disabled && (
          <button
            type="button"
            onClick={onAddDemoPhoto}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] border border-white/10 text-white hover:bg-white/10 hover:border-emerald-500/40 transition-colors shrink-0 shadow-sm self-start"
            title="Load a demo scrap sample photo"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Demo Photo</span>
          </button>
        )}
      </div>

      {/* Validation Error Banner */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Previews & Upload Trigger Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {previews.map((preview, index) => (
          <div
            key={index}
            className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-square shadow-sm"
          >
            <img
              src={preview}
              alt={`Scrap photo ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
              <button
                type="button"
                onClick={() => onRemovePhoto(index)}
                disabled={disabled}
                className="p-2 rounded-full bg-rose-600 text-white hover:bg-rose-700 shadow-md transition-transform active:scale-95"
                title="Remove photo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono border border-white/10">
              #{index + 1}
            </div>
          </div>
        ))}

        {/* Upload Trigger Card */}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-white/15 hover:border-emerald-500/50 hover:bg-white/[0.04] rounded-xl aspect-square transition-all text-center group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/10 group-hover:border-emerald-500/40 flex items-center justify-center mb-1 text-emerald-400 transition-colors shadow-sm">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white group-hover:text-emerald-300">
              Take / Add Photo
            </span>
            <span className="text-[10px] text-emerald-300/50 mt-0.5">JPG, PNG, WebP (up to 5MB)</span>
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Reassurance note */}
      <div className="flex items-center gap-2 text-[11px] text-[#9cb1a4] pt-1 border-t border-white/[0.08]">
        <Info className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
        <span>
          Uploading photos is completely optional. You can continue and submit your pickup without photos.
        </span>
      </div>
    </div>
  );
};
