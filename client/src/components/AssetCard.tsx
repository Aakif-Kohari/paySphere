import React, { MouseEvent } from 'react';

// 1. Explicitly Type the Asset Object Structure
export interface DigitalAsset {
  id: string;
  title: string;
  fileSize: string; // e.g., "4.2 MB"
  fileExtension: 'pdf' | 'zip' | 'csv' | 'xlsx' | 'docx';
  downloadUrl: string;
  thumbnailUrl?: string;
  uploadedAt: string;
}

// 2. Define Rigorous Component Prop Bindings
interface AssetCardProps {
  asset: DigitalAsset;
  onSelect?: (assetId: string) => void;
  onDownloadStart?: (asset: DigitalAsset) => void;
  isDownloadable?: boolean;
}

export default function AssetCard({
  asset,
  onSelect,
  onDownloadStart,
  isDownloadable = true
}: AssetCardProps) {
  
  // 3. Handle Card Click Selection Event Tracking
  const handleCardClick = (): void => {
    if (onSelect) {
      onSelect(asset.id);
    }
  };

  // 4. Type the Action Handle Trigger capturing explicit button isolation
  const handleDownloadTrigger = (e: MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation(); // Block layout event bubbling up to parent card triggers
    if (onDownloadStart) {
      onDownloadStart(asset);
    }
  };

  // 5. Dynamic Asset Extension Badge Resolver
  const getExtensionColor = (ext: string): string => {
    const mappings: Record<string, string> = {
      pdf: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900/30',
      zip: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/30',
      csv: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/30',
      xlsx: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-200 dark:border-green-900/30',
      docx: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/30',
    };
    return mappings[ext] || 'bg-gray-50 text-gray-700 dark:bg-gray-950/40 dark:text-gray-300 border-gray-200 dark:border-gray-800';
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${
        onSelect ? 'cursor-pointer hover:border-gray-200 dark:hover:border-gray-600' : 'cursor-default'
      }`}
    >
      <div className="flex gap-4">
        {/* Visual Media Thumbnail Area Container */}
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-center">
          {asset.thumbnailUrl ? (
            <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {asset.fileExtension}
            </span>
          )}
        </div>

        {/* Content Metadata Display Details */}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate tracking-tight leading-snug">
            {asset.title}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${getExtensionColor(asset.fileExtension)}`}>
              {asset.fileExtension}
            </span>
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
              {asset.fileSize}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer Context Controller Elements */}
      <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
        <span>Added {new Date(asset.uploadedAt).toLocaleDateString()}</span>
        
        {isDownloadable && (
          <button
            onClick={handleDownloadTrigger}
            type="button"
            className="inline-flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            📥 Download
          </button>
        )}
      </div>
    </div>
  );
}
