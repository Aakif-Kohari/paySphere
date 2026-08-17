/**
 * @fileoverview Approval Kanban Board Component
 * @description Interactive drag-and-drop board for managing payroll approval workflows.
 * Uses @hello-pangea/dnd for smooth drag interactions and API integration for status transitions.
 * 
 * Issue: #821
 */

import { useState, useEffect, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import PropTypes from 'prop-types';
import KanbanColumn from './KanbanColumn';
import api from '../services/api';
import { Snackbar, Alert } from '@mui/material';

// Define the workflow columns and valid transitions
const COLUMNS = [
    { id: 'draft', title: 'Draft' },
    { id: 'pending_approval', title: 'In Review' },
    { id: 'approved', title: 'Approved' },
    { id: 'rejected', title: 'Rejected' },
    { id: 'paid', title: 'Paid' },
];

// Valid state transitions to prevent illegal moves
const VALID_TRANSITIONS = {
    draft: ['pending_approval'],
    pending_approval: ['approved', 'rejected', 'draft'],
    approved: ['paid', 'pending_approval'], // Can send back to review
    rejected: ['draft', 'pending_approval'], // Can resubmit
    paid: [], // Terminal state
};

export default function ApprovalKanban({ month, year, onRefresh }) {
    const [boardData, setBoardData] = useState({});
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const currency = localStorage.getItem('currency') || 'INR';

    /**
     * Fetches payroll data and groups by status
     */
    const fetchPayrolls = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/payroll/summary?month=${month}&year=${year}&limit=0`);
            const payrolls = res.data.payrolls || [];

            // Group by status
            const grouped = {};
            COLUMNS.forEach(col => {
                grouped[col.id] = [];
            });

            payrolls.forEach(p => {
                const status = p.status || 'draft';
                if (grouped[status]) {
                    grouped[status].push(p);
                } else {
                    grouped['draft'].push(p); // Fallback
                }
            });

            setBoardData(grouped);
        } catch (error) {
            console.error('Failed to fetch payrolls:', error);
            setSnackbar({ open: true, message: 'Failed to load payroll data', severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, [month, year]);

    useEffect(() => {
        if (month && year) fetchPayrolls();
    }, [month, year, fetchPayrolls]);

    /**
     * Handles drag end event - validates transition and calls API
     */
    const onDragEnd = async (result) => {
        const { source, destination, draggableId } = result;

        // Dropped outside a droppable area
        if (!destination) return;

        // Dropped in the same position
        if (
            source.droppableId === destination.droppableId &&
            source.index === destination.index
        ) {
            return;
        }

        const sourceColumn = source.droppableId;
        const destColumn = destination.droppableId;

        // Validate transition
        if (!VALID_TRANSITIONS[sourceColumn]?.includes(destColumn)) {
            setSnackbar({
                open: true,
                message: `Cannot move from ${sourceColumn} to ${destColumn}`,
                severity: 'warning'
            });
            return;
        }

        // Optimistic UI update
        const newBoardData = { ...boardData };
        const [movedItem] = newBoardData[sourceColumn].splice(source.index, 1);
        movedItem.status = destColumn;
        newBoardData[destColumn].splice(destination.index, 0, movedItem);
        setBoardData(newBoardData);

        // API Call to update status
        try {
            let endpoint = '';
            let payload = { payrollIds: [draggableId] };

            if (destColumn === 'approved') {
                endpoint = '/api/payroll/approve';
            } else if (destColumn === 'rejected') {
                // Rejection requires a reason, prompt user
                const reason = window.prompt('Please provide a reason for rejection:');
                if (!reason) {
                    fetchPayrolls(); // Revert optimistic update
                    return;
                }
                endpoint = '/api/payroll/reject';
                payload.reason = reason;
            } else if (destColumn === 'paid') {
                endpoint = '/api/payroll/mark-paid';
            } else if (destColumn === 'draft' || destColumn === 'pending_approval') {
                // For resubmissions or moving back to draft
                endpoint = '/api/payroll/approve'; // This might need a specific endpoint in backend
                // For now, we'll just show a message
                setSnackbar({
                    open: true,
                    message: 'Manual status changes to Draft/Review require backend support',
                    severity: 'info'
                });
                return;
            }

            await api.post(endpoint, payload);

            setSnackbar({
                open: true,
                message: `Payroll moved to ${destColumn}`,
                severity: 'success'
            });

            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Failed to update payroll status:', error);
            setSnackbar({
                open: true,
                message: error.response?.data?.message || 'Failed to update status',
                severity: 'error'
            });
            // Revert optimistic update on failure
            fetchPayrolls();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto pb-4">
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-4 min-w-max px-4">
                    {COLUMNS.map(column => (
                        <KanbanColumn
                            key={column.id}
                            column={column}
                            payrolls={boardData[column.id] || []}
                            currency={currency}
                        />
                    ))}
                </div>
            </DragDropContext>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setSnackbar(s => ({ ...s, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

ApprovalKanban.propTypes = {
    month: PropTypes.number.isRequired,
    year: PropTypes.number.isRequired,
    onRefresh: PropTypes.func,
};
