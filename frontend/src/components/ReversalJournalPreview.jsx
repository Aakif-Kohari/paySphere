import PropTypes from 'prop-types';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

export default function ReversalJournalPreview({ journalEntries }) {
    if (!journalEntries || journalEntries.length === 0) {
        return <p className="text-sm text-gray-500 dark:text-slate-400">No journal entries generated.</p>;
    }

    return (
        <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
                <AccountBalanceIcon className="text-gray-600 dark:text-slate-400" fontSize="small" />
                <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200">Negative Journal Preview</h3>
            </div>
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-700">
                        <th className="pb-2">Account</th>
                        <th className="pb-2 text-center">Nature</th>
                        <th className="pb-2 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {journalEntries.map((leg, i) => (
                        <tr key={i}>
                            <td className="py-2 text-gray-700 dark:text-slate-300">{leg.accountName}</td>
                            <td className="py-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${leg.nature === 'Debit' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
                                    {leg.nature}
                                </span>
                            </td>
                            <td className="py-2 text-right font-mono font-bold text-red-600 dark:text-red-400">
                                -₹{leg.amount.toLocaleString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

ReversalJournalPreview.propTypes = {
    journalEntries: PropTypes.array.isRequired
};
