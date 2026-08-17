import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import DescriptionIcon from '@mui/icons-material/Description';
import SendIcon from '@mui/icons-material/Send';
import VisibilityIcon from '@mui/icons-material/Visibility';

export default function OfferLetterBuilder() {
    const [step, setStep] = useState(1); // 1: Details, 2: Preview, 3: Success
    const [formData, setFormData] = useState({
        candidateName: '',
        candidateEmail: '',
        basicSalary: '',
        joiningDate: '',
        roleName: '',
        companyName: localStorage.getItem('companyName') || 'PaySphere'
    });
    const [previewHtml, setPreviewHtml] = useState('');
    const [magicLink, setMagicLink] = useState('');
    const [loading, setLoading] = useState(false);

    // Mock HTML Template for demonstration
    const MOCK_TEMPLATE = `
    <h2>OFFER OF EMPLOYMENT</h2>
    <p>Dear <strong>{{candidateName}}</strong>,</p>
    <p>We are pleased to offer you the position of <strong>{{roleName}}</strong> at <strong>{{companyName}}</strong>.</p>
    <p>Your anticipated date of joining will be <strong>{{joiningDate}}</strong>.</p>
    <p>Your Annual Basic Salary will be <strong>INR {{basicSalary}}</strong> per annum, subject to statutory deductions.</p>
    <p>We look forward to welcoming you to the team.</p>
    <p>Sincerely,<br/>HR Department<br/>{{companyName}}</p>
  `;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePreview = () => {
        let html = MOCK_TEMPLATE;
        for (const [key, value] of Object.entries(formData)) {
            html = html.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
        }
        setPreviewHtml(html);
        setStep(2);
    };

    const handleIssue = async () => {
        setLoading(true);
        try {
            // Mock template ID for demonstration
            const res = await api.post('/api/contracts/issue', {
                templateId: '65f1a2b3c4d5e6f7g8h9i0j1',
                candidateName: formData.candidateName,
                candidateEmail: formData.candidateEmail,
                variables: formData
            });
            setMagicLink(res.data.magicLink);
            setStep(3);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to issue contract');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Contracts" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <DescriptionIcon /> Offer Letter Builder
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-4xl mx-auto">
                    {/* Stepper */}
                    <div className="flex items-center justify-center mb-8">
                        {[1, 2, 3].map(s => (
                            <div key={s} className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? 'bg-brand-600 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-500'}`}>{s}</div>
                                {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-brand-600' : 'bg-gray-200 dark:bg-slate-700'}`}></div>}
                            </div>
                        ))}
                    </div>

                    {step === 1 && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Candidate & Offer Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input name="candidateName" placeholder="Candidate Full Name" value={formData.candidateName} onChange={handleChange} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                                <input name="candidateEmail" type="email" placeholder="Candidate Email" value={formData.candidateEmail} onChange={handleChange} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                                <input name="roleName" placeholder="Role / Designation" value={formData.roleName} onChange={handleChange} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                                <input name="basicSalary" type="number" placeholder="Annual Basic Salary (INR)" value={formData.basicSalary} onChange={handleChange} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                                <input name="joiningDate" type="date" value={formData.joiningDate} onChange={handleChange} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                            </div>
                            <div className="flex justify-end">
                                <button onClick={handlePreview} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                                    <VisibilityIcon fontSize="small" /> Preview Letter
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Preview Offer Letter</h2>
                            <div className="p-8 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                            <div className="flex justify-between">
                                <button onClick={() => setStep(1)} className="px-6 py-2 text-gray-600 dark:text-slate-400 font-semibold">Back to Edit</button>
                                <button onClick={handleIssue} disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2 disabled:opacity-50">
                                    <SendIcon fontSize="small" /> {loading ? 'Generating...' : 'Issue & Send Magic Link'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-gray-200 dark:border-slate-700 text-center space-y-4">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                                <SendIcon className="text-green-600 dark:text-green-400" fontSize="large" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Offer Letter Dispatched!</h2>
                            <p className="text-sm text-gray-600 dark:text-slate-400">A secure magic link has been generated and sent to the candidate's email.</p>
                            <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 text-left">
                                <p className="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wider mb-1">Magic Link (For Testing)</p>
                                <p className="text-sm font-mono text-brand-600 dark:text-brand-400 break-all">{magicLink}</p>
                            </div>
                            <button onClick={() => { setStep(1); setFormData({ ...formData, candidateName: '', candidateEmail: '' }); }} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Issue Another Offer</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
