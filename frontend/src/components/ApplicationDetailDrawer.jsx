import PropTypes from 'prop-types';
import CloseIcon from '@mui/icons-material/Close';

const STATUSES = ['Applied', 'Screening', 'Interviewing', 'Offered', 'Hired', 'Rejected'];

export default function ApplicationDetailDrawer({ application, onClose, onStatusUpdate }) {
    if (!application) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md bg-white dark:bg-slate-800 h-full shadow-2xl p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Applicant Details</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white">
                        <CloseIcon />
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{application.applicantId?.fullName}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400">{application.applicantId?.role} in {application.applicantId?.department}</p>
                        <p className="text-sm text-brand-600 dark:text-brand-400 mt-1">{application.applicantId?.email}</p>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Cover Letter</h4>
                        <p className="text-sm text-gray-600 dark:text-slate-400 italic">"{application.coverLetter || 'No cover letter provided.'}"</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Move to Stage:</label>
                        <div className="grid grid-cols-2 gap-2">
                            {STATUSES.map(status => (
                                <button
                                    key={status}
                                    onClick={() => onStatusUpdate(application._id, status)}
                                    disabled={application.status === status}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition ${application.status === status
                                            ? 'bg-brand-600 text-white cursor-default'
                                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                        {application.status === 'Hired' && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-semibold">
                                * Moving to "Hired" will trigger the Seamless Transfer Engine and update their department/manager.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

ApplicationDetailDrawer.propTypes = {
    application: PropTypes.object,
    onClose: PropTypes.func.isRequired,
    onStatusUpdate: PropTypes.func.isRequired
};
