import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ApartmentIcon from '@mui/icons-material/Apartment';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { formatCurrency } from '../utils/currency';

export default function EntityHierarchy() {
    const [entities, setEntities] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const currency = localStorage.getItem('currency') || 'INR';

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [hierRes, repRes] = await Promise.all([
                api.get('/api/entities/hierarchy'),
                api.get('/api/entities/consolidated-report')
            ]);
            setEntities(hierRes.data.entities);
            setReport(repRes.data.report);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const rootEntities = entities.filter(e => !e.parentId);
    const getChildEntities = (parentId) => entities.filter(e => e.parentId && e.parentId._id === parentId);

    const renderTreeNode = (entity, depth = 0) => {
        const children = getChildEntities(entity._id);
        const entityReport = report?.entityBreakdown.find(b => b.entityId === entity.tenantId);

        return (
            <div key={entity._id} className="ml-6 mt-3 border-l-2 border-gray-200 dark:border-slate-700 pl-4">
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                    <AccountTreeIcon className={depth === 0 ? 'text-brand-600' : 'text-gray-400'} />
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{entity.entityName}</h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Code: {entity.entityCode} | Ownership: {entity.ownershipPercentage}%</p>
                    </div>
                    {entityReport && (
                        <div className="text-right">
                            <p className="text-xs text-gray-500 dark:text-slate-400">Headcount</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{entityReport.headcount}</p>
                        </div>
                    )}
                </div>
                {children.map(child => renderTreeNode(child, depth + 1))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Entities" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ApartmentIcon /> Corporate Hierarchy & Deputation
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Entity Tree</h2>
                            {loading ? <p className="text-gray-500">Loading hierarchy...</p> :
                                rootEntities.length === 0 ? <p className="text-gray-500">No entities registered.</p> :
                                    rootEntities.map(root => renderTreeNode(root))
                            }
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-brand-50 dark:bg-brand-900/20 p-6 rounded-xl border border-brand-200 dark:border-brand-800">
                            <h3 className="text-sm font-bold text-brand-800 dark:text-brand-200 uppercase tracking-wider">Consolidated Metrics</h3>
                            <div className="mt-4 space-y-3">
                                <div>
                                    <p className="text-xs text-brand-600 dark:text-brand-400">Total Group Headcount</p>
                                    <p className="text-2xl font-bold text-brand-900 dark:text-brand-100">{report?.totalConsolidatedHeadcount || 0}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-brand-600 dark:text-brand-400">Total Group Payroll</p>
                                    <p className="text-2xl font-bold text-brand-900 dark:text-brand-100">{formatCurrency(report?.totalConsolidatedPayroll || 0, currency)}</p>
                                </div>
                            </div>
                        </div>

                        <button className="w-full py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2">
                            <SwapHorizIcon /> Initiate Cross-Entity Deputation
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
