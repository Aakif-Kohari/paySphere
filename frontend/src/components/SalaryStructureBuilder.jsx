/**
 * SalaryStructureBuilder.jsx - Issue #1111
 *
 * Interactive salary structure editor with:
 *   - Draggable component list (add, remove, reorder)
 *   - Formula input per component with validation
 *   - Live preview panel (calls POST /api/salary-structures/preview)
 *   - Dependency graph visualization
 *   - Circular dependency detection
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';

const COMPONENT_TYPES = [
  { value: 'earning',   label: 'Earning',   color: 'emerald' },
  { value: 'deduction', label: 'Deduction',  color: 'red' },
];

const SAMPLE_CONTEXT = {
  basic: 50000,
  grossPay: 80000,
  leaveDays: 0,
  overtimeHours: 0,
};

let nextId = 1;
function generateId() { return 'comp_' + (nextId++); }

function createDefaultComponent(type = 'earning') {
  return {
    id: generateId(),
    code: '',
    name: '',
    type,
    formula: '',
    order: 0,
  };
}

export default function SalaryStructureBuilder({ employeeId, onSave }) {
  const [components, setComponents] = useState([
    { ...createDefaultComponent('earning'), code: 'BASIC', name: 'Basic Salary', formula: 'grossPay * 0.50' },
    { ...createDefaultComponent('earning'), code: 'HRA', name: 'House Rent Allowance', formula: 'BASIC * 0.40' },
    { ...createDefaultComponent('earning'), code: 'CONVEYANCE', name: 'Conveyance Allowance', formula: '1600' },
    { ...createDefaultComponent('deduction'), code: 'PF', name: 'Provident Fund', formula: 'BASIC * 0.12' },
    { ...createDefaultComponent('deduction'), code: 'PROF_TAX', name: 'Professional Tax', formula: '200' },
  ]);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const previewTimerRef = useRef(null);

  // Auto-preview with debounce
  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => runPreview(), 800);
    return () => clearTimeout(previewTimerRef.current);
  }, [components]);

  const runPreview = useCallback(async () => {
    const validComponents = components
      .filter((c) => c.code && c.formula)
      .map((c, i) => ({ ...c, order: i }));

    if (validComponents.length === 0) {
      setPreview(null);
      return;
    }

    setPreviewLoading(true);
    setPreviewError('');
    try {
      const res = await api.post('/api/salary-structures/preview', {
        components: validComponents,
        context: SAMPLE_CONTEXT,
      });
      setPreview(res.data);
      setValidationErrors([]);
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) {
        setValidationErrors(data.errors);
      } else {
        setPreviewError(data?.message || 'Preview failed.');
      }
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [components]);

  const addComponent = useCallback((type) => {
    setComponents((prev) => [...prev, { ...createDefaultComponent(type), order: prev.length }]);
  }, []);

  const removeComponent = useCallback((id) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateComponent = useCallback((id, field, value) => {
    setComponents((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  }, []);

  // Drag-and-drop handlers
  const handleDragStart = useCallback((idx) => setDragIdx(idx), []);
  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setComponents((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(idx);
  }, [dragIdx]);
  const handleDragEnd = useCallback(() => setDragIdx(null), []);

  const formatCurrency = (val) =>
    val != null ? '\u20B9' + Number(val).toLocaleString('en-IN') : '-';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Component Editor */}
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Salary Components</h3>
          <div className="flex gap-2">
            <button onClick={() => addComponent('earning')} className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-900 transition">
              + Earning
            </button>
            <button onClick={() => addComponent('deduction')} className="px-3 py-1.5 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900 transition">
              + Deduction
            </button>
          </div>
        </div>

        {/* Component List */}
        <div className="space-y-2">
          {components.map((comp, idx) => {
            const typeColor = comp.type === 'earning'
              ? 'border-l-emerald-400 dark:border-l-emerald-500'
              : 'border-l-red-400 dark:border-l-red-500';
            return (
              <div
                key={comp.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 border-l-4 ${typeColor} p-4 hover:shadow-md transition cursor-grab active:cursor-grabbing`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-gray-300 dark:text-slate-600 mt-2 cursor-grab">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="8" cy="4" r="2"/><circle cx="16" cy="4" r="2"/>
                      <circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/>
                      <circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/>
                    </svg>
                  </div>
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input value={comp.code} onChange={(e) => updateComponent(comp.id, 'code', e.target.value.toUpperCase())} placeholder="CODE" className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                    <input value={comp.name} onChange={(e) => updateComponent(comp.id, 'name', e.target.value)} placeholder="Name" className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                    <select value={comp.type} onChange={(e) => updateComponent(comp.id, 'type', e.target.value)} className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                      {COMPONENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button onClick={() => removeComponent(comp.id)} className="px-2 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-xs transition">
                      Remove
                    </button>
                  </div>
                </div>
                <div className="mt-2 ml-7">
                  <input value={comp.formula} onChange={(e) => updateComponent(comp.id, 'formula', e.target.value)} placeholder='e.g. BASIC * 0.40 or 1600' className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Use other component codes as variables. Supported: +, -, *, /, ( )</p>
                </div>
              </div>
            );
          })}
        </div>

        {components.length === 0 && (
          <div className="text-center py-8 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 border-dashed">
            <p className="text-gray-500 dark:text-slate-400">No components added yet. Click + to add one.</p>
          </div>
        )}
      </div>

      {/* Preview Panel */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Live Preview</h4>
            {previewLoading && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
          </div>
          <div className="p-5">
            {validationErrors.length > 0 ? (
              <div className="space-y-2">
                {validationErrors.map((err, i) => (
                  <div key={i} className="text-xs bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg px-3 py-2">{err}</div>
                ))}
              </div>
            ) : previewError ? (
              <div className="text-xs bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg px-3 py-2">{previewError}</div>
            ) : preview ? (
              <div className="space-y-3">
                {/* Earnings */}
                <div>
                  <p className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-bold mb-1">Earnings</p>
                  {Object.values(preview.lineItems).filter((l) => l.type === 'earning').map((item) => (
                    <div key={item.name} className="flex justify-between text-xs py-1">
                      <span className="text-gray-600 dark:text-slate-400">{item.name}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-1 border-t border-gray-100 dark:border-slate-800 mt-1">
                    <span className="text-slate-900 dark:text-white">Total Earnings</span>
                    <span className="text-emerald-700 dark:text-emerald-300">{formatCurrency(preview.totalEarnings)}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <p className="text-[10px] uppercase text-red-600 dark:text-red-400 font-bold mb-1">Deductions</p>
                  {Object.values(preview.lineItems).filter((l) => l.type === 'deduction').map((item) => (
                    <div key={item.name} className="flex justify-between text-xs py-1">
                      <span className="text-gray-600 dark:text-slate-400">{item.name}</span>
                      <span className="font-semibold text-red-500 dark:text-red-400">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-1 border-t border-gray-100 dark:border-slate-800 mt-1">
                    <span className="text-slate-900 dark:text-white">Total Deductions</span>
                    <span className="text-red-600 dark:text-red-300">{formatCurrency(preview.totalDeductions)}</span>
                  </div>
                </div>

                {/* Net */}
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 mt-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-blue-700 dark:text-blue-300">Net Monthly</span>
                    <span className="text-blue-800 dark:text-blue-200">{formatCurrency(preview.totalEarnings - preview.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">Add components with formulas to see a preview</p>
            )}
          </div>
        </div>

        {/* Dependency Graph */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-5">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Dependency Graph</h4>
          <div className="space-y-1.5">
            {components.filter((c) => c.code && c.formula).map((comp) => {
              const deps = components
                .filter((other) => other.code !== comp.code && comp.formula.includes(other.code))
                .map((other) => other.code);
              return (
                <div key={comp.id} className="flex items-center gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${comp.type === 'earning' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>
                    {comp.code}
                  </span>
                  {deps.length > 0 && (
                    <>
                      <svg className="w-3 h-3 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <span className="text-gray-400 dark:text-slate-500">{deps.join(', ')}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
