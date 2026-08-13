/**
 * @fileoverview POSH Grievance Filing Portal
 * @description A secure, accessible form for employees to report grievances 
 * anonymously or identified, complying with POSH Act confidentiality requirements.
 * Issue: #958
 */
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import ShieldIcon from '@mui/icons-material/Shield';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

export default function GrievancePortal() {
    const [formData, setFormData] = useState({
        isAnonymous: true,
        respondentId: '',
        incidentDate: '',
        description: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [caseNumber, setCaseNumber] = useState('');
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            const res = await api.post('/api/grievances/file', formData);
            setCaseNumber(res.data.caseNumber);
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit grievance. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center border border-gray-200 dark:border-slate-700">
                    <CheckCircleOutlineIcon className="text-green-500" sx={{ fontSize: 64 }} />
                    <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Grievance Filed Securely</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        Your complaint has been encrypted and routed to the Internal Complaints Committee (ICC).
                        Please save your case number for future reference.
                    </p>
                    <div className="mt-6 p-4 bg-gray-100 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wider">Case Number</p>
                        <p className="text-2xl font-mono font-bold text-brand-600 dark:text-brand-400">{caseNumber}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <Helmet><title>Secure Grievance Portal | PaySphere</title></Helmet>
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden">

                    {/* Header */}
                    <div className="bg-brand-600 p-6 text-white">
                        <div className="flex items-center gap-3">
                            <ShieldIcon fontSize="large" />
                            <div>
                                <h1 className="text-xl font-bold">Internal Complaints Committee (ICC) Portal</h1>
                                <p className="text-sm text-brand-100">Secure & Confidential Grievance Redressal</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Confidentiality Notice */}
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
                            <LockIcon className="text-blue-600 dark:text-blue-400 mt-0.5" />
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                                <strong>End-to-End Encrypted:</strong> Your submission is encrypted at rest. Standard HR and Admin roles cannot access this data. Only verified ICC members can decrypt and review case details.
                            </p>
                        </div>

                        {/* Anonymity Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700">
                            <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">File Anonymously</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">Your identity will not be linked to this case.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="isAnonymous" checked={formData.isAnonymous} onChange={handleChange} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-brand-600"></div>
                            </label>
                        </div>

                        {/* Form Fields */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Date of Incident *</label>
                                <input type="date" name="incidentDate" value={formData.incidentDate} onChange={handleChange} required className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Detailed Description *</label>
                                <textarea name="description" value={formData.description} onChange={handleChange} required rows="6" placeholder="Please describe the incident in detail. This text will be encrypted." className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500" />
                            </div>
                        </div>

                        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                        <button type="submit" disabled={submitting} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:opacity-50">
                            {submitting ? 'Encrypting & Submitting...' : 'Submit Securely'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
