/**
 * BulkImport.jsx - Issue #1112
 *
 * Multi-step wizard for bulk CSV employee import:
 *   Step 1: Upload CSV + column mapping
 *   Step 2: Validation preview (green/red rows, error tooltips)
 *   Step 3: Confirm commit or fix errors
 *   Step 4: Progress bar during import
 *   Step 5: Summary with rollback button
 */
import { useState, useCallback, useRef } from 'react';
import api from '../services/api';

const SCHEMA_FIELDS = [
  { value: 'fullName',       label: 'Full Name',       required: true },
  { value: 'email',          label: 'Email',            required: false },
  { value: 'department',     label: 'Department',       required: true },
  { value: 'monthlySalary',  label: 'Monthly Salary',   required: true },
  { value: 'phone',          label: 'Phone',            required: false },
  { value: 'joiningDate',    label: 'Joining Date',     required: false },
  { value: 'role',           label: 'Role',             required: false },
  { value: 'employmentStatus', label: 'Employment Status', required: false },
];

const STEPS = [
  { id: 'upload',   label: 'Upload & Map' },
  { id: 'preview',  label: 'Validation Preview' },
  { id: 'confirm',  label: 'Confirm Import' },
  { id: 'progress', label: 'Importing' },
  { id: 'done',     label: 'Summary' },
];

export default function BulkImport({ onComplete }) {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  // Parse CSV headers on file selection
  const handleFileSelect = useCallback((e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError('');

    // Read first line to get headers
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const firstLine = text.split('\n')[0];
      const headers = firstLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      setCsvHeaders(headers);

      // Auto-map by name similarity
      const autoMap = {};
      headers.forEach((h) => {
        const lower = h.toLowerCase().replace(/[\s_-]+/g, '');
        const match = SCHEMA_FIELDS.find((f) => {
          const fLower = f.value.toLowerCase();
          return lower === fLower || lower.includes(fLower) || fLower.includes(lower);
        });
        if (match) autoMap[h] = match.value;
      });
      setMapping(autoMap);
    };
    reader.readAsText(selected);
  }, []);

  const handleMappingChange = useCallback((csvCol, schemaField) => {
    setMapping((prev) => ({ ...prev, [csvCol]: schemaField || undefined }));
  }, []);

  // Upload and validate
  const handleUpload = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('csv', file);
      if (Object.keys(mapping).length > 0) {
        formData.append('mapping', JSON.stringify(mapping));
      }

      const res = await api.post('/api/employees/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setJobId(res.data.jobId);
      setPreview(res.data);
      setStep('preview');
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setImporting(false);
    }
  }, [file, mapping]);

  // Commit the import
  const handleCommit = useCallback(async () => {
    if (!jobId) return;
    setStep('progress');
    setImporting(true);
    try {
      const res = await api.post(`/api/employees/import/${jobId}/commit`);
      setResult(res.data);
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Commit failed.');
      setStep('confirm');
    } finally {
      setImporting(false);
    }
  }, [jobId]);

  // Rollback
  const handleRollback = useCallback(async () => {
    if (!jobId) return;
    try {
      await api.delete(`/api/employees/import/${jobId}`);
      setResult({ rolledBack: true });
      onComplete?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Rollback failed.');
    }
  }, [jobId, onComplete]);

  const resetWizard = () => {
    setStep('upload');
    setFile(null);
    setCsvHeaders([]);
    setMapping({});
    setPreview(null);
    setJobId(null);
    setResult(null);
    setError('');
  };

  const requiredUnmapped = SCHEMA_FIELDS.filter((f) => {
    if (!f.required) return false;
    return !Object.values(mapping).includes(f.value);
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Step indicator */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step === s.id
                  ? 'bg-blue-600 text-white'
                  : STEPS.findIndex((x) => x.id === step) > idx
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500'
              }`}>
                {STEPS.findIndex((x) => x.id === step) > idx ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span className={`ml-1.5 text-xs font-semibold hidden sm:inline ${
                step === s.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'
              }`}>{s.label}</span>
              {idx < STEPS.length - 1 && <div className="w-6 h-0.5 bg-gray-200 dark:bg-slate-700 mx-2" />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Select CSV File</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="w-full text-sm text-gray-600 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100"
              />
            </div>

            {csvHeaders.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Column Mapping</h4>
                <p className="text-xs text-gray-500 dark:text-slate-400">Map CSV columns to employee fields. Required fields are marked with *.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {csvHeaders.map((header) => (
                    <div key={header} className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-slate-400 truncate min-w-[120px]">{header}</span>
                      <svg className="w-4 h-4 text-gray-300 dark:text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <select
                        value={mapping[header] || ''}
                        onChange={(e) => handleMappingChange(header, e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">-- Skip --</option>
                        {SCHEMA_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}{f.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {requiredUnmapped.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 text-sm text-amber-700 dark:text-amber-300">
                    Missing required fields: {requiredUnmapped.map((f) => f.label).join(', ')}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || importing || requiredUnmapped.length > 0}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md"
            >
              {importing ? 'Validating...' : 'Upload & Validate'}
            </button>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <>
            <div className="flex gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 flex-1 text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{preview.totalRows}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold">Total Rows</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4 flex-1 text-center">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{preview.validRows}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Valid</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 flex-1 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{preview.errorRows}</p>
                <p className="text-xs text-red-500 dark:text-red-400 font-semibold">Errors</p>
              </div>
            </div>

            {preview.errors && preview.errors.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Validation Errors</h4>
                {preview.errors.map((err, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2">
                    <span className="text-red-500 dark:text-red-400 font-mono text-xs">Row {err.row}</span>
                    <span className="text-red-700 dark:text-red-300">{err.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep('upload')} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition">
                Back
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={preview.validRows === 0}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md"
              >
                Proceed to Import ({preview.validRows} rows)
              </button>
            </div>
          </>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4">
              <p className="text-sm text-amber-700 dark:text-amber-300 font-semibold">
                You are about to import {preview?.validRows} employee records. This action will create new employee records in the database.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                You can rollback this import later from the Import History.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('preview')} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition">
                Back
              </button>
              <button
                onClick={handleCommit}
                disabled={importing}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md"
              >
                {importing ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </>
        )}

        {/* Step 4: Progress */}
        {step === 'progress' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-lg font-bold text-slate-900 dark:text-white">Importing employees...</p>
            <p className="text-sm text-gray-500 dark:text-slate-400">Creating {preview?.validRows} records in batches</p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 'done' && result && (
          <div className="text-center py-6 space-y-4">
            {result.rolledBack ? (
              <>
                <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-950 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">Import Rolled Back</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">All imported records have been removed.</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">Import Complete</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">{result.imported} employees created successfully.</p>
                <div className="flex gap-3 justify-center pt-2">
                  <button onClick={handleRollback} className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 transition">
                    Rollback Import
                  </button>
                  <button onClick={() => { onComplete?.(); resetWizard(); }} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-md">
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
