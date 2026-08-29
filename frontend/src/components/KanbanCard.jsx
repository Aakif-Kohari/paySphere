/**
 * @fileoverview Kanban Card Component
 * @description Represents a single payroll record in the Kanban board.
 * Displays employee name, amount, and status with drag handle.
 * 
 * Issue: #821
 */

import { Draggable } from '@hello-pangea/dnd';
import PropTypes from 'prop-types';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PersonIcon from '@mui/icons-material/Person';
import { formatCurrency } from '../utils/currency';

export default function KanbanCard({ payroll, index, currency }) {
    const getInitials = (name) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    return (
        <Draggable draggableId={payroll._id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`
            bg-white dark:bg-slate-800 
            border border-gray-200 dark:border-slate-700 
            rounded-xl p-4 mb-3 shadow-sm
            transition-all duration-200
            ${snapshot.isDragging
                            ? 'shadow-xl ring-2 ring-blue-500 rotate-2 scale-105'
                            : 'hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600'
                        }
          `}
                >
                    {/* Drag Handle */}
                    <div
                        {...provided.dragHandleProps}
                        className="flex justify-end mb-2 text-gray-400 dark:text-slate-500 cursor-grab active:cursor-grabbing"
                        aria-label="Drag to move"
                    >
                        <DragIndicatorIcon fontSize="small" />
                    </div>

                    {/* Employee Info */}
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {getInitials(payroll.employeeName)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                {payroll.employeeName}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                                {payroll.month}/{payroll.year}
                            </p>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 dark:text-slate-400">Base</span>
                            <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                                {formatCurrency(payroll.baseSalary, currency)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 dark:text-slate-400">Net Pay</span>
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                {formatCurrency(payroll.netSalary, currency)}
                            </span>
                        </div>
                    </div>

                    {/* Rejection Reason (if applicable) */}
                    {payroll.rejectionReason && (
                        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-xs text-red-700 dark:text-red-300 line-clamp-2">
                                {payroll.rejectionReason}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </Draggable>
    );
}

KanbanCard.propTypes = {
    payroll: PropTypes.object.isRequired,
    index: PropTypes.number.isRequired,
    currency: PropTypes.string.isRequired,
};
