import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import SchoolIcon from '@mui/icons-material/School';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ErrorIcon from '@mui/icons-material/Error';

export default function TrainingCatalog() {
    const [records, setRecords] = useState([]);
    const [complianceCheck, setComplianceCheck] = useState({ isCompliant: true });
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/training/my-training');
            setRecords(res.data.records);
            setComplianceCheck(res.data.complianceCheck);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleUpload = async (recordId) => {
        // Mock file upload
        const mockUrl = `mock://certs/${recordId}.pdf`;
        try {
            await api.post('/api/training/certificates', { recordId, certificateUrl: mockUrl });
            alert('Certificate uploaded and verified!');
            fetchData();
        } catch (err) { alert('Upload failed.'); }
    };

    const getStatusBadge = (status, expiresAt) => {
        if (status === 'Completed' && expiresAt && new Date(expiresAt) < new Date()) {
            return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Expired</span>;
        }
        const styles = {
            Completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            Assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            'In Progress': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
            Expired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
            Waived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
        };
        return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.Assigned}`}>{status}</span>;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Training" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SchoolIcon /> Training & Certification Catalog
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {!complianceCheck.isCompliant && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                            <ErrorIcon className="text-red-600 dark:text-red-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">Compliance Warning: Appraisal Blocked</h3>
                                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                    You cannot submit your performance self-review until the following mandatory courses are completed:
                                    <strong> {complianceCheck.missingCourses.join(', ')}</strong>
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Course</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Expires</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">Loading catalog...</td></tr>
                                ) : records.length === 0 ? (
                                    <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">No training courses assigned.</td></tr>
                                ) : (
                                    records.map(rec => (
                                        <tr key={rec._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {rec.courseId?.isMandatory && <WarningAmberIcon className="text-amber-500" fontSize="small" titleAccess="Mandatory" />}
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{rec.courseId?.title}</p>
                                                        <p className="text-xs text-gray-500 dark:text-slate-400">{rec.courseId?.category}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">{getStatusBadge(rec.status, rec.expiresAt)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">
                                                {rec.expiresAt ? new Date(rec.expiresAt).toLocaleDateString() : 'Lifetime'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {rec.status === 'Assigned' || rec.status === 'In Progress' ? (
                                                    <button onClick={() => handleUpload(rec._id)} className="text-brand-600 hover:text-brand-800 dark:text-brand-400 flex items-center gap-1 mx-auto text-sm font-semibold">
                                                        <CloudUploadIcon fontSize="small" /> Upload Cert
                                                    </button>
                                                ) : rec.status === 'Completed' ? (
                                                    <CheckCircleIcon className="text-green-500 mx-auto" />
                                                ) : (
                                                    <span className="text-gray-400 text-sm">-</span>
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
    );
}
