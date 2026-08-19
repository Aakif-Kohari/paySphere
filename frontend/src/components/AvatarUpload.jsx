import { useId, useRef, useState } from 'react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SOURCE_SIZE = 10 * 1024 * 1024;
const MAX_DIMENSION = 512;

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected file could not be read as an image.'));
    };
    image.src = url;
  });

const canvasToDataUrl = (canvas, type) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, dataUrl: canvas.toDataURL(type, 0.88) }) : reject(new Error('Unable to create image preview.'))),
      type,
      0.88,
    );
  });

/**
 * An accessible avatar picker that resizes images in the browser before exposing
 * a compact data URL to its parent. The parent remains responsible for saving it.
 */
export default function AvatarUpload({ value = '', onChange, onError }) {
  const inputRef = useRef(null);
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const reportError = (message) => {
    setProgress(0);
    setStatus('');
    onError?.(message);
  };

  const processFile = async (file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      reportError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_SOURCE_SIZE) {
      reportError('Image files must be smaller than 10 MB.');
      return;
    }

    try {
      setProgress(15);
      setStatus('Preparing image...');
      const image = await loadImage(file);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image resizing is unavailable in this browser.');
      context.drawImage(image, 0, 0, width, height);

      setProgress(65);
      setStatus('Creating preview...');
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const { blob, dataUrl } = await canvasToDataUrl(canvas, outputType);
      setProgress(100);
      setStatus(`Ready - ${width} x ${height} - ${formatBytes(blob.size)}`);
      onChange(dataUrl);
    } catch (error) {
      reportError(error.message || 'Unable to prepare this image.');
    }
  };

  const selectFile = (files) => {
    setIsDragging(false);
    processFile(files?.[0]);
  };

  return (
    <div className="w-full max-w-lg">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          selectFile(event.target.files);
          event.target.value = '';
        }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a profile picture"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          selectFile(event.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-4 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
          : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-blue-500 dark:hover:bg-slate-800'
          }`}
      >
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
            {value ? <img src={value} alt="New profile preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl" aria-hidden="true">Upload</div>}
          </div>
          <div className="min-w-0 text-left">
            <p className="font-semibold text-gray-800 dark:text-white">Drop a photo here or click to browse</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">JPEG, PNG, or WebP - up to 10 MB - resized to 512 px</p>
          </div>
        </div>
        {(progress > 0 || status) && (
          <div className="mt-3" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
              <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
