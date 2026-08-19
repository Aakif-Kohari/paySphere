import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';

export default function FleetDashboard() {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchFleet(); }, []);

    const fetchFleet = async () => {
        try {
            const res = await api.get('/api/fleet/vehicles');
            setVehicles(res.data.vehicles);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const getStatusColor = (status) => {
        if (status === 'Available') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        if (status === 'Assigned') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Fleet" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <LocalShippingIcon /> Fleet Management & Maintenance
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading ? (
                            <p className="col-span-full text-center text-gray-500 py-12">Loading fleet...</p>
                        ) : vehicles.map(v => (
                            <div key={v._id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <DirectionsCarIcon className="text-gray-400" />
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{v.licensePlate}</h3>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(v.status)}`}>
                                        {v.status}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">{v.make} {v.model} ({v.year})</p>
                                <p className="text-xs text-gray-500 dark:text-slate-500">
                                    Odometer: <strong className="text-gray-800 dark:text-slate-200">{v.currentOdometer.toLocaleString()} km</strong>
                                </p>
                                <p className="text-xs text-gray-500 dark:text-slate-500">
                                    Next Service: <strong className="text-gray-800 dark:text-slate-200">{v.nextServiceOdometer.toLocaleString()} km</strong>
                                </p>

                                {v.fuelAnomaly?.isAnomaly && (
                                    <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                                        <WarningAmberIcon className="text-red-600 dark:text-red-400 text-sm mt-0.5" />
                                        <p className="text-xs text-red-700 dark:text-red-300 font-medium">{v.fuelAnomaly.message}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
