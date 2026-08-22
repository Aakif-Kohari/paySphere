import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import HubIcon from '@mui/icons-material/Hub';
import PieChartIcon from '@mui/icons-material/PieChart';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

export default function MatrixOrgChart() {
    const [allocations, setAllocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [formData, setFormData] = useState({ splits: [], useTimesheetAllocation: false });

    useEffect(() => { fetchAllocations(); }, []);

    const fetchAllocations = async () => {
        try {
            const res = await api.get('/api/matrix/allocations');
            setAllocations(res.data.allocations);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSelect = (alloc) => {
        setSelectedEmp(alloc);
        setFormData({
            splits: alloc.splits || [],
            useTimesheetAllocation: alloc.useTimesheetAllocation || false
        });
    };

    const addSplit = () => {
        setFormData({ ...formData, splits: [...formData.splits, { costCenterName: '', costCenterCode: '', percentageWeight: 0 }] });
    };

    const removeSplit = (idx) => {
        const newSplits = [...formData.splits];
        newSplits.splice(idx, 1);
        setFormData({ ...formData, splits: newSplits });
    };

    const updateSplit = (idx, field, value) => {
        const newSplits = [...formData.splits];
        newSplits[idx][field] = value;
        setFormData({ ...formData, splits: newSplits });
    };

    const handleSave = async () => {
        try {
            await api.post('/api/matrix/allocation', {
                employeeId: selectedEmp.employeeId._id,
                ...formData
            });
            alert('Allocation saved!');
            fetchAllocations();
            setSelectedEmp(null);
        } catch (err) { alert(err.response?.data?.message || 'Save failed.'); }
    };

    const totalWeight = formData.splits.reduce((sum, s) => sum + Number(s.percentageWeight || 0), 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="MatrixOrg" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HubIcon /> Matrix Organization & Cost Allocation
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Employee List */}
                    <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Employees with Matrix Roles</h2>
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
                            {loading ? (
                                <p className="p-4 text-center text-gray-500 text-sm">Loading...</p>
                            ) : allocations.map(a => (
                                <button key={a._id} onClick={() => handleSelect(a)} className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{a.employeeId?.fullName}</p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">{a.employeeId?.role}</p>
                                    <div className="flex gap-2 mt-2">
                                        <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">
                                            Admin: {a.administrativeManagerId?.fullName || 'None'}
                                        </span>
                                        <span className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">
                                            Ops: {a.operationalManagerId?.fullName || 'None'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Configuration Panel */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 min-h-[400px]">
                        {!selectedEmp ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
                                <PieChartIcon fontSize="large" />
                                <p className="mt-2 text-sm">Select an employee to configure cost center splits.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedEmp.employeeId?.fullName}</h2>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.useTimesheetAllocation}
                                            onChange={e => setFormData({ ...formData, useTimesheetAllocation: e.target.checked })}
                                            className="rounded text-brand-600"
                                            id="tsToggle"
                                        />
                                        <label htmlFor="tsToggle" className="text-sm text-gray-700 dark:text-slate-300">Use Dynamic Timesheet Allocation</label>
                                    </div>
                                </div>

                                {!formData.useTimesheetAllocation && (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300">Static Cost Center Splits</h3>
                                            <button onClick={addSplit} className="text-xs text-brand-600 font-bold flex items-center gap-1 hover:underline">
                                                <AddIcon fontSize="small" /> Add Split
                                            </button>
                                        </div>

                                        {formData.splits.map((s, i) => (
                                            <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                                                <input type="text" placeholder="Center Name" value={s.costCenterName} onChange={e => updateSplit(i, 'costCenterName', e.target.value)} className="col-span-4 px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                                                <input type="text" placeholder="Code" value={s.costCenterCode} onChange={e => updateSplit(i, 'costCenterCode', e.target.value)} className="col-span-3 px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                                                <div className="col-span-4 flex items-center gap-1">
                                                    <input type="number" value={s.percentageWeight} onChange={e => updateSplit(i, 'percentageWeight', e.target.value)} className="w-full px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                                                    <span className="text-xs text-gray-500">%</span>
                                                </div>
                                                <button onClick={() => removeSplit(i)} className="col-span-1 text-red-500 hover:text-red-700 flex justify-center">
                                                    <DeleteIcon fontSize="small" />
                                                </button>
                                            </div>
                                        ))}

                                        <div className={`text-sm font-bold text-right ${Math.abs(totalWeight - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                                            Total Weight: {totalWeight}% {Math.abs(totalWeight - 100) > 0.01 && '(Must be 100%)'}
                                        </div>
                                    </div>
                                )}

                                {formData.useTimesheetAllocation && (
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <p className="text-sm text-blue-800 dark:text-blue-200">
                                            <strong>Dynamic Mode Active:</strong> Cost allocation will be calculated automatically based on approved timesheet hours logged against projects for the payroll month. Static splits defined here will be ignored.
                                        </p>
                                    </div>
                                )}

                                <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-slate-700">
                                    <button onClick={handleSave} disabled={!formData.useTimesheetAllocation && Math.abs(totalWeight - 100) > 0.01} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 disabled:opacity-50">
                                        Save Allocation Rules
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
