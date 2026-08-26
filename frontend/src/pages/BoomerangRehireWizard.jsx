import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ReplayIcon from '@mui/icons-material/Replay';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function BoomerangRehireWizard() {
    const [step, setStep] = useState(1); // 1: Search, 2: Preview, 3: Success
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedAlumni, setSelectedAlumni] = useState(null);
    const [newEmployeeId, setNewEmployeeId] = useState('');
    const [reconciliationPreview, setReconciliationPreview] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.get(`/api/alumni/search?query=${query}`);
            setSearchResults(res.data.alumni || []);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSelectAlumni = (alumni) => {
        setSelectedAlumni(alumni);
        setStep(2);
    };

    const handlePreviewReconciliation = async () => {
        if (!newEmployeeId) return alert('Enter the new Employee ID created for this rehire.');
        // In a real app, this would call a preview endpoint. Mocking for demo.
        setReconciliationPreview({
            combinedTenureDays: 1250,
            restoredLeaveTier: 'Senior',
            restoredVestingSchedule: true
        });
    };

    const handleConfirmRehire = async () => {
        setLoading(true);
        try {
            await api.post('/api/alumni/rehire', {
                alumniProfileId: selectedAlumni._id,
                newEmployeeId
            });
            setStep(3);
        } catch (err) { alert(err.response?.data?.message || 'Rehire failed.'); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Alumni" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ReplayIcon className="text-brand-500" /> Boomerang Rehire Wizard
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-3xl mx-auto">
                    {step === 1 && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-4">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Step 1: Find Alumni Profile</h2>
                            <form onSubmit={handleSearch} className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Search by Name, Email, or PAN/SSN..."
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                />
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                                    <SearchIcon fontSize="small" /> Search
                                </button>
                            </form>

                            <div className="space-y-2 mt-4">
                                {searchResults.map(a => (
                                    <button
                                        key={a._id}
                                        onClick={() => handleSelectAlumni(a)}
                                        disabled={!a.isEligibleForRehire}
                                        className="w-full p-4 text-left bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <p className="font-bold text-gray-900 dark:text-white">{a.fullName}</p>
                                        <p className="text-xs text-gray-500 dark:text-slate-400">
                                            Previous Tenure: {Math.round(a.totalPreviousTenureDays / 365.25 * 10) / 10} years | Exit: {a.exitReason}
                                        </p>
                                        {!a.isEligibleForRehire && <p className="text-xs text-red-500 font-bold mt-1">Not eligible for rehire</p>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && selectedAlumni && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-6">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Step 2: Reconcile Tenure for {selectedAlumni.fullName}</h2>

                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    <strong>Original Tenure:</strong> {new Date(selectedAlumni.originalJoinDate).toLocaleDateString()} to {new Date(selectedAlumni.exitDate).toLocaleDateString()}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">New Employee Record ID</label>
                                <input
                                    type="text"
                                    placeholder="Enter the ID of the newly created employee record"
                                    value={newEmployeeId}
                                    onChange={e => setNewEmployeeId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                />
                                <button onClick={handlePreviewReconciliation} className="mt-2 text-sm text-brand-600 font-bold hover:underline">
                                    Preview Reconciliation
                                </button>
                            </div>

                            {reconciliationPreview && (
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
                                    <h3 className="text-sm font-bold text-green-800 dark:text-green-200">Reconciliation Preview</h3>
                                    <p className="text-sm text-green-700 dark:text-green-300">Combined Tenure: <strong>{reconciliationPreview.combinedTenureDays} days</strong></p>
                                    <p className="text-sm text-green-700 dark:text-green-300">Restored Leave Tier: <strong>{reconciliationPreview.restoredLeaveTier}</strong></p>
                                    <p className="text-sm text-green-700 dark:text-green-300">ESOP Vesting Restored: <strong>{reconciliationPreview.restoredVestingSchedule ? 'Yes' : 'No'}</strong></p>
                                </div>
                            )}

                            <div className="flex justify-between">
                                <button onClick={() => setStep(1)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Back</button>
                                <button onClick={handleConfirmRehire} disabled={loading || !reconciliationPreview} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 disabled:opacity-50">
                                    {loading ? 'Processing...' : 'Confirm Rehire & Restore Benefits'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center space-y-4">
                            <CheckCircleIcon className="text-green-500" style={{ fontSize: 64 }} />
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Rehire Successful!</h2>
                            <p className="text-gray-600 dark:text-slate-400">
                                Tenure has been reconciled and legacy benefits have been restored to the new employee record.
                            </p>
                            <button onClick={() => { setStep(1); setSelectedAlumni(null); setReconciliationPreview(null); }} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700">
                                Process Another Rehire
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
