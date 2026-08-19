import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import ShieldIcon from '@mui/icons-material/Shield';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export default function WhistleblowerPortal() {
    const [step, setStep] = useState(1); // 1: Form, 2: Success
    const [tenantId, setTenantId] = useState(''); // In a real app, derived from URL subdomain or public config
    const [formData, setFormData] = useState({ title: '', body: '' });
    const [trackingToken, setTrackingToken] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Mocking tenantId for demonstration
            const res = await api.post('/api/grievances/submit', {
                tenantId: tenantId || '65f1a2b3c4d5e6f7g8h9i0j1',
                title: formData.title,
                body: formData.body
            });
            setTrackingToken(res.data.trackingToken);
            setStep(2);
        } catch (err) {
            alert('Failed to submit report securely.');
        } finally {
            setLoading(false);
        }
    };

    const copyToken = () => {
        navigator.clipboard.writeText(trackingToken);
        alert('Tracking token copied to clipboard.');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <Helmet>
                <title>Anonymous Ethics Portal</title>
            </Helmet>

            <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-8">
                {step === 1 && (
                    <>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                                <ShieldIcon className="text-brand-600 dark:text-brand-400" fontSize="large" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Anonymous Ethics Portal</h1>
                                <p className="text-xs text-gray-500 dark:text-slate-400">End-to-End Encrypted & Untraceable</p>
                            </div>
                        </div>

                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-6 flex items-start gap-2">
                            <VisibilityOffIcon className="text-amber-600 dark:text-amber-400 mt-0.5" />
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                                Your identity is completely hidden. The report body is encrypted using AES-256 before saving. Not even database administrators can read your submission.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Report Title</label>
                                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Detailed Description</label>
                                <textarea value={formData.body} onChange={e => setFormData({ ...formData, body: e.target.value })} required rows="6" className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg disabled:opacity-50">
                                {loading ? 'Encrypting & Submitting...' : 'Submit Anonymously'}
                            </button>
                        </form>
                    </>
                )}

                {step === 2 && (
                    <div className="text-center space-y-6">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                            <ShieldIcon className="text-green-600 dark:text-green-400" fontSize="large" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Report Submitted Securely</h2>
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                            The Ethics Committee will review your report. Save the tracking token below to check the status of your case later. <strong>This is the only way to access your case.</strong>
                        </p>

                        <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2">
                            <code className="text-sm font-mono text-brand-600 dark:text-brand-400 break-all">{trackingToken}</code>
                            <button onClick={copyToken} className="p-2 text-gray-500 hover:text-brand-600">
                                <ContentCopyIcon fontSize="small" />
                            </button>
                        </div>

                        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white rounded-lg font-semibold">
                            Close Portal
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
