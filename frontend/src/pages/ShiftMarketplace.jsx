import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ShiftBiddingCard from '../components/ShiftBiddingCard';

export default function ShiftMarketplace() {
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchShifts(); }, []);

    const fetchShifts = async () => {
        try {
            const res = await api.get('/api/shifts/marketplace');
            setShifts(res.data.shifts);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleBid = async (shiftId) => {
        try {
            await api.post(`/api/shifts/marketplace/${shiftId}/bid`, { message: 'I am available and ready.' });
            alert('Bid placed successfully! You will be notified if selected.');
            fetchShifts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to place bid.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Marketplace" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <StorefrontIcon /> Shift Marketplace
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8">
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Open Shifts:</strong> Claim available hours below. Bids are automatically prioritized based on your department match and tenure.
                        </p>
                    </div>

                    {loading ? (
                        <p className="text-center text-gray-500 py-12">Loading available shifts...</p>
                    ) : shifts.length === 0 ? (
                        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-gray-500 dark:text-slate-400">No open shifts available at the moment. Check back later!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {shifts.map(shift => (
                                <ShiftBiddingCard key={shift._id} shift={shift} onBid={handleBid} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
