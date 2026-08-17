/**
 * @fileoverview Asset Registry Page
 * @description Displays company assets, their current assignees, book values,
 * and provides modals for assigning/returning equipment.
 * Issue: #955
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';
import LaptopMacIcon from '@mui/icons-material/LaptopMac';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';

export default function Assets() {
    const navigate = useNavigate();
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activePage, setActivePage] = useState('Assets');
    const currency = localStorage.getItem('currency') || 'INR';

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const res = await api.get('/api/assets');
                setAssets(res.data.assets);
            } catch (err) {
                console.error('Failed to fetch assets', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAssets();
    }, []);

    const getStatusBadge = (status) => {
        const styles = {
            Available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            Assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            Maintenance: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
            Retired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
            Lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        };
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.Available}`}>
                {status}
            </span>
        );
    };

    return (
        <>
            <Helmet><title>Asset Registry | PaySphere</title></Helmet>
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
                <Sidebar activePage={activePage} setActivePage={(p) => { setActivePage(p); navigate(`/${p.toLowerCase()}`); }} isSidebarOpen={false} onClose={() => { }} />

                <div className="lg:ml-64">
                    <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <LaptopMacIcon /> Asset Registry
                        </h1>
                        <ThemeToggle />
                    </div>

                    <div className="p-4 lg:p-8">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Asset</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Category</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Assignee</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Book Value</th>
                                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Status</th>
                                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                                        {loading ? (
                                            <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">Loading assets...</td></tr>
                                        ) : assets.length === 0 ? (
                                            <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">No assets registered yet.</td></tr>
                                        ) : (
                                            assets.map((asset) => (
                                                <tr key={asset._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{asset.name}</div>
                                                        <div className="text-xs text-gray-500 dark:text-slate-400">S/N: {asset.serialNumber}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">
                                                        {asset.categoryId?.name || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">
                                                        {asset.assignedTo ? asset.assignedTo.fullName : <span className="text-gray-400 italic">Unassigned</span>}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-900 dark:text-white">
                                                        {formatCurrency(asset.currentBookValue, currency)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        {getStatusBadge(asset.status)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                        {asset.status === 'Available' && (
                                                            <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Assign">
                                                                <AssignmentIndIcon fontSize="small" />
                                                            </button>
                                                        )}
                                                        {asset.status === 'Assigned' && (
                                                            <button className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300" title="Return">
                                                                <AssignmentReturnIcon fontSize="small" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
