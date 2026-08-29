import { useState } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function EcrGeneratorWizard({ onClose, onSuccess }) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ type: 'EPFO', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await api.post('/api/statutory/generate', formData);
            setResult(res.data.challan);
            setStep(2);
        } catch (err) {
            alert(err.response?.data?.message || 'Generation failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-slate-400">
                    <CloseIcon />
                </button>

                {step === 1 && (
                    <>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Generate Statutory ECR</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Statutory Type</label>
                                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                    <option value="EPFO">EPFO (Provident Fund)</option>
                                    <option value="ESIC">ESIC (State Insurance)</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Month</label>
                                    <select value={formData.month} onChange={e => setFormData({ ...formData, month: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Year</label>
                                    <input type="number" value={formData.year} onChange={e => setFormData({ ...formData, year: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                            </div>
                            <button onClick={handleGenerate} disabled={loading} className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 disabled:opacity-50">
                                {loading ? 'Validating & Generating...' : 'Generate ECR File'}
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && result && (
                    <>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Generation Complete</h2>

                        {result.validationErrors.length > 0 && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4 flex items-start gap-2">
                                <WarningAmberIcon className="text-red-600 dark:text-red-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-red-800 dark:text-red-200">Validation Warnings ({result.validationErrors.length})</p>
                                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                        {result.validationErrors.length} employees were excluded from the ECR due to missing UANs or wage ceiling breaches. Fix their profiles and regenerate.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mb-4">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 mb-2">Challan Summary</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <p className="text-gray-600 dark:text-slate-400">Total Employees:</p>
                                <p className="text-right font-bold text-gray-900 dark:text-white">{result.totalEmployees}</p>
                                <p className="text-gray-600 dark:text-slate-400">Gross Wages:</p>
                                <p className="text-right font-bold text-gray-900 dark:text-white">₹{result.totalGrossWages.toLocaleString()}</p>
                                <p className="text-gray-600 dark:text-slate-400">Total Payable:</p>
                                <p className="text-right font-bold text-brand-600 dark:text-brand-400">₹{result.totalChallanAmount.toLocaleString()}</p>
                            </div>
                        </div>

                        <button onClick={onSuccess} className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">
                            Done - Save to Vault
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

EcrGeneratorWizard.propTypes = {
    onClose: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired
};
