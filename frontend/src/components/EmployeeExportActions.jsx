/**
 * @fileoverview Employee Export Actions Component
 * @description Provides UI controls for exporting the employee directory to CSV and PDF formats.
 * Handles loading states, error handling, and integrates with the backend CSV API and client-side PDF utility.
 * 
 * Issue: #511
 */

import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { exportEmployeesToPDF } from '../utils/pdfExport';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

/**
 * EmployeeExportActions Component
 * 
 * @param {Object} props - Component props
 * @param {Array} props.employees - The current list of employees to export
 * @returns {JSX.Element} The rendered export action buttons
 */
export default function EmployeeExportActions({ employees }) {
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const { toast } = useToast();

    const companyName = useAppStore((state) => state.user?.companyName) || localStorage.getItem('companyName') || 'PaySphere';
    const currency = localStorage.getItem('currency') || 'INR';

    /**
     * Handles the CSV export by fetching the file from the backend API
     */
    const handleExportCSV = async () => {
        if (!employees || employees.length === 0) {
            toast.warning('No employees to export.');
            return;
        }

        setIsExportingCSV(true);
        try {
            const res = await api.get('/api/employees/export-csv', { responseType: 'blob' });

            const blob = res.data;
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            toast.success('CSV exported successfully!');
        } catch (err) {
            console.error('CSV Export failed:', err);
            let errorMessage = 'Failed to export CSV.';
            if (err.response && err.response.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    const json = JSON.parse(text);
                    errorMessage = json.message || errorMessage;
                } catch (e) {}
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err.message) {
                errorMessage = err.message;
            }
            toast.error(errorMessage);
        } finally {
            setIsExportingCSV(false);
        }
    };

    /**
     * Handles the PDF export using the client-side jsPDF utility
     */
    const handleExportPDF = async () => {
        if (!employees || employees.length === 0) {
            toast.warning('No employees to export.');
            return;
        }

        setIsExportingPDF(true);
        try {
            await exportEmployeesToPDF(employees, { companyName, currency });
            toast.success('PDF exported successfully!');
        } catch (err) {
            console.error('PDF Export failed:', err);
            toast.error(err.message || 'Failed to export PDF.');
        } finally {
            setIsExportingPDF(false);
        }
    };

    return (
        <div className="flex flex-wrap gap-3">
            {/* CSV Export Button */}
            <button
                onClick={handleExportCSV}
                disabled={isExportingCSV || isExportingPDF}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                aria-label="Export employees to CSV"
            >
                {isExportingCSV ? (
                    <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <FileDownloadIcon fontSize="small" />
                )}
                {isExportingCSV ? 'Exporting...' : 'Export CSV'}
            </button>

            {/* PDF Export Button (Issue #511) */}
            <button
                onClick={handleExportPDF}
                disabled={isExportingCSV || isExportingPDF}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition shadow-sm shadow-indigo-200 dark:shadow-none"
                aria-label="Export employees to PDF"
            >
                {isExportingPDF ? (
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <PictureAsPdfIcon fontSize="small" />
                )}
                {isExportingPDF ? 'Generating...' : 'Export to PDF'}
            </button>
        </div>
    );
}

