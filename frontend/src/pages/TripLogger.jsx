import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AddRoadIcon from '@mui/icons-material/AddRoad';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export default function TripLogger() {
    const [vehicles, setVehicles] = useState([]);
    const [formData, setFormData] = useState({
        vehicleId: '', date: new Date().toISOString().split('T')[0],
        startOdometer: '', endOdometer: '', fuelAddedLiters: '', fuelCost: '', purpose: 'Business'
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchVehicles(); }, []);

    const fetchVehicles = async () => {
        try {
            const res = await api.get('/api/fleet/vehicles');
            // Filter to only show vehicles assigned to the current user or available
            setVehicles(res.data.vehicles.filter(v => v.status === 'Assigned' || v.status === 'Available'));
            if (res.data.vehicles.length > 0) setFormData(f => ({ ...f, vehicleId: res.data.vehicles[0]._id }));
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (Number(formData.endOdometer) <= Number(formData.startOdometer)) {
            alert('End odometer must be greater than start odometer.');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/api/fleet/trips', formData);
            if (res.data.maintenanceAlert) {
                alert(`Trip logged! WARNING: ${res.data.maintenanceAlert}`);
            } else {
                alert('Trip logged successfully!');
            }
            setFormData({ ...formData, startOdometer: formData.endOdometer, endOdometer: '', fuelAddedLiters: '', fuelCost: '' });
        } catch (err) { alert('Failed to log trip.'); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="TripLogger" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AddRoadIcon /> Daily Trip Logger
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-2xl mx-auto">
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Vehicle</label>
                            <select value={formData.vehicleId} onChange={e => setFormData({ ...formData, vehicleId: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                {vehicles.map(v => <option key={v._id} value={v._id}>{v.licensePlate} - {v.make} {v.model}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Start Odometer (km)</label>
                                <input type="number" value={formData.startOdometer} onChange={e => setFormData({ ...formData, startOdometer: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">End Odometer (km)</label>
                                <input type="number" value={formData.endOdometer} onChange={e => setFormData({ ...formData, endOdometer: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Fuel Added (Liters)</label>
                                <input type="number" step="0.01" value={formData.fuelAddedLiters} onChange={e => setFormData({ ...formData, fuelAddedLiters: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Fuel Cost</label>
                                <input type="number" step="0.01" value={formData.fuelCost} onChange={e => setFormData({ ...formData, fuelCost: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="w-full py-3 bg-brand-600 text-white font-bold rounded-lg disabled:opacity-50">
                            {loading ? 'Logging...' : 'Submit Trip Log'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
