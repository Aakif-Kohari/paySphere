import { useState } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export default function ChallanUploadModal({ challan, onClose, onSuccess }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;
        setLoading(true);
        try {
            // Mocking file upload to S3
            const mockReceiptUrl = `mock://receipts/${challan._id}-${file.name}`;
            await api.post('/api/statutory/upload-receipt', { challanId: challan._id, receiptUrl: mockReceiptUrl });
            onSuccess();
        } catch (err) {
            alert('Upload failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Upload Payment Proof</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                    Challan: {challan.type} for {challan.month}/{challan.year} (₹{challan.totalChallanAmount.toLocaleString()})
                </p>

                <form onSubmit={handleUpload} className="space-y-4">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                        <CloudUploadIcon className="text-gray-400 dark:text-slate-500" fontSize="large" />
                        <span className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                            {file ? file.name : 'Click to upload portal receipt/UTR'}
                        </span>
                        <input type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
                    </label>

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                        <button type="submit" disabled={!file || loading} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                            {loading ? 'Uploading...' : 'Mark as Paid'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

ChallanUploadModal.propTypes = {
    challan: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired
};
