/**
 * @fileoverview Virtualized Table Component
 * @description A high-performance table wrapper using react-window to only render 
 * visible rows in the DOM. Prevents UI freezing and memory bloat when displaying 
 * thousands of employee records.
 * 
 * Issue: #1030
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized-auto-sizer'; // Note: If not installed, we use a manual resize observer fallback below.

/**
 * Custom hook to track container width without external dependencies.
 */
function useContainerWidth(ref) {
    const [width, setWidth] = useState(0);

    useEffect(() => {
        if (!ref.current) return;

        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });

        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ref]);

    return width;
}

/**
 * Virtualized Table Component
 * 
 * @param {Object} props 
 * @param {Array} props.data - Array of row data objects
 * @param {Function} props.renderRow - Function to render a single row (receives { index, style, data })
 * @param {number} props.rowHeight - Fixed height of each row in pixels
 * @param {React.ReactNode} props.header - The table header component
 * @param {number} props.headerHeight - Height of the header in pixels
 */
export default function VirtualizedTable({
    data,
    renderRow,
    rowHeight = 64,
    header,
    headerHeight = 48,
    emptyState
}) {
    const containerRef = useRef(null);
    const listRef = useRef(null);
    const containerWidth = useContainerWidth(containerRef);
    const [scrollLeft, setScrollLeft] = useState(0);

    /**
     * Syncs horizontal scroll between the header and the virtualized list body.
     */
    const handleScroll = useCallback(({ scrollLeft: newScrollLeft }) => {
        setScrollLeft(newScrollLeft);
    }, []);

    /**
     * Syncs header scroll when user scrolls the header directly (if header is scrollable)
     */
    const handleHeaderScroll = (e) => {
        if (listRef.current) {
            listRef.current.scrollTo({ scrollLeft: e.target.scrollLeft });
        }
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                {emptyState || (
                    <p className="text-gray-500 dark:text-slate-400">No records found.</p>
                )}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="w-full h-full bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col"
        >
            {/* Sticky Header */}
            <div
                className="flex-shrink-0 overflow-x-auto scrollbar-hide border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50"
                style={{ height: `${headerHeight}px` }}
                onScroll={handleHeaderScroll}
            >
                <div style={{ minWidth: '100%', width: 'max-content', transform: `translateX(-${scrollLeft}px)` }}>
                    {header}
                </div>
            </div>

            {/* Virtualized Body */}
            <div className="flex-1 min-h-0">
                {containerWidth > 0 && (
                    <List
                        ref={listRef}
                        height={Math.min(600, data.length * rowHeight)} // Max height 600px or content height
                        itemCount={data.length}
                        itemSize={rowHeight}
                        width={containerWidth}
                        itemData={data}
                        onScroll={handleScroll}
                        overscanCount={5} // Render 5 extra rows above/below viewport for smooth scrolling
                        className="scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent"
                    >
                        {renderRow}
                    </List>
                )}
            </div>
        </div>
    );
}

VirtualizedTable.propTypes = {
    data: PropTypes.array.isRequired,
    renderRow: PropTypes.func.isRequired,
    rowHeight: PropTypes.number,
    header: PropTypes.node.isRequired,
    headerHeight: PropTypes.number,
    emptyState: PropTypes.node
};
