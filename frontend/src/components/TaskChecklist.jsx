import PropTypes from 'prop-types';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PendingIcon from '@mui/icons-material/Pending';
import BlockIcon from '@mui/icons-material/Block';
import { formatDate } from '../utils/formatLocale';

const statusConfig = {
    Completed: { icon: <CheckCircleIcon className="text-green-500" />, bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300' },
    'In Progress': { icon: <PendingIcon className="text-amber-500" />, bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300' },
    Pending: { icon: <RadioButtonUncheckedIcon className="text-gray-400" />, bg: 'bg-gray-50 dark:bg-slate-800', text: 'text-gray-700 dark:text-slate-300' },
    Blocked: { icon: <BlockIcon className="text-red-500" />, bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300' },
};

export default function TaskChecklist({ tasks, onStatusChange, isManager = false }) {
    return (
        <div className="space-y-3">
            {tasks.map((task) => {
                const config = statusConfig[task.status] || statusConfig.Pending;
                const isOverdue = task.status !== 'Completed' && new Date(task.dueDate) < new Date();

                return (
                    <div key={task._id} className={`p-4 rounded-xl border border-gray-200 dark:border-slate-700 ${config.bg} transition-all`}>
                        <div className="flex items-start gap-3">
                            <button
                                onClick={() => onStatusChange(task._id, task.status === 'Completed' ? 'Pending' : 'Completed')}
                                className="mt-0.5 focus:outline-none"
                                disabled={!isManager && task.department !== 'Employee'}
                            >
                                {config.icon}
                            </button>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className={`text-sm font-bold ${task.status === 'Completed' ? 'line-through text-gray-500 dark:text-slate-500' : 'text-gray-900 dark:text-white'}`}>
                                        {task.title}
                                    </h4>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.text} ${config.bg} border border-current opacity-80`}>
                                        {task.department}
                                    </span>
                                </div>
                                {task.description && (
                                    <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">{task.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs">
                                    <span className={`font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-500'}`}>
                                        Due: {formatDate(task.dueDate)} {isOverdue && '(Overdue)'}
                                    </span>
                                    {task.completedAt && (
                                        <span className="text-green-600 dark:text-green-400">
                                            Completed: {formatDate(task.completedAt)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

TaskChecklist.propTypes = {
    tasks: PropTypes.array.isRequired,
    onStatusChange: PropTypes.func.isRequired,
    isManager: PropTypes.bool,
};
