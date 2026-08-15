/**
 * @fileoverview Vendor Directory & Ledger Page
 * @description Displays external contractors, their invoices, and automated 194C TDS deductions.
 * Issue: #957
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';
import StoreIcon from '@mui/icons-material/Store';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function Vendors() {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activePage, setActivePage] = useState('Vendors');
    const currency = localStorage.getItem('currency') || 'INR';

    useEffect(() => {
        const fetchVendors = async () => {
            try {
                // Assuming a GET /api/vendors endpoint exists or fetching via ledger
                // For this UI, we'll mock the vendor list structure
                const res = await api.get('/api/vendors');
                setVendors(res.data.vendors || []);
            } catch (err) {
                console.error('Failed to fetch vendors', err);
            } finally {
                setLoading(false);
            }
        };
        fetchVendors();
    }, []);

    return (
        <>
            <Helmet><title>Vendor & Contractor Ledger | PaySphere</title></Helmet>
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
                <Sidebar activePage={activePage} setActivePage={(p) => { setActivePage(p); navigate(`/${p.toLowerCase()}`); }} isSidebarOpen={false} onClose={() => { }} />

                <div className="lg:ml-64">
                    <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <StoreIcon /> Vendor & Contractor Ledger
                        </h1>
                        <ThemeToggle />
                    </div>

                    <div className="p-4 lg:p-8">
                        {/* TDS Warning Banner */}
                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                            <WarningAmberIcon className="text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Section 194C Compliance Active</h3>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                    TDS is automatically deducted at 1% (Individual) or 2% (Others) when single invoices exceed ₹30,000 or aggregate FY payments cross ₹1,00,000. Missing PAN attracts 20% penalty.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Vendor Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">PAN / GSTIN</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Type</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">YTD TDS Deducted</th>
                                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                                        {loading ? (
                                            <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">Loading vendors...</td></tr>
                                        ) : vendors.length === 0 ? (
                                            <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">No vendors registered. Add a contractor to begin tracking invoices.</td></tr>
                                        ) : (
                                            vendors.map((vendor) => (
                                                <tr key={vendor._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{vendor.name}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 dark:text-slate-300">
                                                        {vendor.pan || <span className="text-red-500 italic text-xs">Missing PAN (20% TDS)</span>}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{vendor.vendorType}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-900 dark:text-white">
                                                        {formatCurrency(vendor.ytdTds || 0, currency)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                        <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400" title="View Ledger">
                                                            <ReceiptLongIcon fontSize="small" />
                                                        </button>
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
