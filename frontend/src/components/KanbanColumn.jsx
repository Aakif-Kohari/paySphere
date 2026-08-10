/**
 * @fileoverview Kanban Column Component
 * @description Represents a status column (Droppable area) in the Kanban board.
 * 
 * Issue: #821
 */

import { Droppable } from '@hello-pangea/dnd';
import PropTypes from 'prop-types';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column, payrolls, currency }) {
    const getColumnStyles = (status) => {
        switch (status) {
            case 'draft':
                return { header: 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300', badge: 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200' };
            case 'pending_approval':
                return { header: 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300', badge: 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' };
            case 'approved':
                return { header: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300', badge: 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' };
            case 'paid':
                return { header: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300', badge: 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' };
            case 'rejected':
                return { header: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300', badge: 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' };
            default:
                return { header: 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300', badge: 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200' };
        }
    };

    const styles = getColumnStyles(column.id);

    return (
        <div className="flex flex-col w-80 flex-shrink-0 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            {/* Column Header */}
            <div className={`px-4 py-3 ${styles.header} flex items-center justify-between`}>
                <h3 className="font-bold text-sm uppercase tracking-wider">
                    {column.title}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${styles.badge}`}>
                    {payrolls.length}
                </span>
            </div>

            {/* Droppable Area */}
            <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`
              flex-1 p-3 overflow-y-auto min-h-[400px] max-h-[calc(100vh-300px)]
              transition-colors duration-200
              ${snapshot.isDraggingOver
                                ? 'bg-blue-50/50 dark:bg-blue-900/10'
                                : ''
                            }
            `}
                    >
                        {payrolls.map((payroll, index) => (
                            <KanbanCard
                                key={payroll._id}
                                payroll={payroll}
                                index={index}
                                currency={currency}
                            />
                        ))}
                        {provided.placeholder}

                        {payrolls.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-slate-500 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg">
                                <p className="text-sm font-medium">No items</p>
                                <p className="text-xs mt-1">Drag cards here</p>
                            </div>
                        )}
                    </div>
                )}
            </Droppable>
        </div>
    );
}

KanbanColumn.propTypes = {
    column: PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
    }).isRequired,
    payrolls: PropTypes.array.isRequired,
    currency: PropTypes.string.isRequired,
};
