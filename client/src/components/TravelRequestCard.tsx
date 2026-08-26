import React, { MouseEvent } from 'react';

// 1. Explicitly Type the Travel Request Data Schema
export interface TravelRequestData {
  id: string;
  employeeName: string;
  destination: string;
  startDate: string;
  endDate: string;
  estimatedCost: number;
  status: 'pending' | 'approved' | 'rejected';
  purpose: string;
}

// 2. Define Rigorous Component Prop Bindings
interface TravelRequestCardProps {
  request: TravelRequestData;
  onApprove?: (requestId: string) => Promise<void>;
  onReject?: (requestId: string) => Promise<void>;
  onViewDetails?: (requestId: string) => void;
}

export default function TravelRequestCard({
  request,
  onApprove,
  onReject,
  onViewDetails
}: TravelRequestCardProps) {

  // 3. Resolve Dynamic Color Palettes for Status Badges Safely
  const getStatusStyles = (status: TravelRequestData['status']) => {
    const styles = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/30',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/30',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/30'
    };
    return styles[status] || styles.pending;
  };

  // 4. Type the Action Handlers and Prevent Component Bubbling
  const handleActionClick = (e: MouseEvent<HTMLButtonElement>, action: 'approve' | 'reject'): void => {
    e.stopPropagation(); // Stop parent container card selection click loops
    if (action === 'approve' && onApprove) {
      onApprove(request.id);
    } else if (action === 'reject' && onReject) {
      onReject(request.id);
    }
  };

  const handleCardSelection = (): void => {
    if (onViewDetails) {
      onViewDetails(request.id);
    }
  };

  return (
    <div
      onClick={handleCardSelection}
      className={`p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm transition-all duration-200 flex flex-col justify-between ${
        onViewDetails ? 'cursor-pointer hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600' : 'cursor-default'
      }`}
    >
      <div>
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0">
            <h4 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Travel Request</h4>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100 mt-1 truncate leading-tight">
              {request.employeeName}
            </h3>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusStyles(request.status)}`}>
            {request.status}
          </span>
        </div>

        <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <p className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-400 dark:text-gray-500">📍 Destination:</span> {request.destination}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-400 dark:text-gray-500">📅 Timeline:</span> {new Date(request.startDate).toLocaleDateString()} – {new Date(request.endDate).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-1 line-clamp-2">
            "{request.purpose}"
          </p>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-700/60 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-black tracking-wider text-gray-400">Estimated Budget</span>
          <span className="text-lg font-mono font-black text-gray-900 dark:text-gray-100">
            ${request.estimatedCost.toLocaleString()}
          </span>
        </div>

        {request.status === 'pending' && (onApprove || onReject) && (
          <div className="flex gap-2">
            {onReject && (
              <button
                onClick={(e) => handleActionClick(e, 'reject')}
                type="button"
                className="px-3 py-1.5 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
              >
                Reject
              </button>
            )}
            {onApprove && (
              <button
                onClick={(e) => handleActionClick(e, 'approve')}
                type="button"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm transition-all"
              >
                Approve
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
