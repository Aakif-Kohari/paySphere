/**
 * @fileoverview HTML5 Canvas Organizational Chart Visualizer
 * @description A highly interactive, zoomable, and pannable org chart rendered
 * entirely on HTML5 Canvas for high performance with large datasets.
 * Supports dark/light mode, node hover states, and smooth animations.
 * 
 * Issue: #816
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
    buildTree,
    layoutTree,
    getTreeBounds,
    LAYOUT_CONFIG
} from '../utils/orgChartLayout';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';

/**
 * Canvas Org Chart Component
 */
export default function OrgChartCanvas({ employees }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const animationFrameRef = useRef(null);

    // Viewport state (pan and zoom)
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hoveredNode, setHoveredNode] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Build and layout tree when data changes
    const treeDataRef = useRef(null);

    useEffect(() => {
        if (!employees || employees.length === 0) return;

        const { root } = buildTree(employees);
        if (root) {
            layoutTree(root, LAYOUT_CONFIG.PADDING, LAYOUT_CONFIG.PADDING);
            treeDataRef.current = root;

            // Center the tree initially
            const bounds = getTreeBounds(root);
            const container = containerRef.current;
            if (container) {
                const centerX = (container.clientWidth - bounds.width) / 2 - bounds.minX;
                const centerY = (container.clientHeight - bounds.height) / 2 - bounds.minY;
                setOffset({ x: centerX, y: centerY });
            }
        }
    }, [employees]);

    // Detect dark mode
    useEffect(() => {
        const checkDarkMode = () => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        };
        checkDarkMode();

        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, []);

    /**
     * Main render loop using requestAnimationFrame
     */
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx || !treeDataRef.current) return;

        // High-DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Apply transformations (pan and zoom)
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // Theme colors
        const colors = isDarkMode ? {
            bg: '#0f172a',
            nodeBg: '#1e293b',
            nodeBorder: '#334155',
            nodeText: '#f8fafc',
            nodeSubtext: '#94a3b8',
            line: '#475569',
            hoverBg: '#334155',
            hoverBorder: '#3b82f6',
        } : {
            bg: '#ffffff',
            nodeBg: '#ffffff',
            nodeBorder: '#e2e8f0',
            nodeText: '#0f172a',
            nodeSubtext: '#64748b',
            line: '#cbd5e1',
            hoverBg: '#f8fafc',
            hoverBorder: '#2563eb',
        };

        /**
         * Recursive function to draw edges and nodes
         */
        function drawNode(node) {
            if (!node) return;

            // Draw edges to children first (so they appear behind nodes)
            if (node.children) {
                node.children.forEach(child => {
                    ctx.beginPath();
                    ctx.strokeStyle = colors.line;
                    ctx.lineWidth = 2;

                    // Bezier curve from bottom-center of parent to top-center of child
                    const startX = node.x + node.width / 2;
                    const startY = node.y + node.height;
                    const endX = child.x + child.width / 2;
                    const endY = child.y;

                    const midY = (startY + endY) / 2;

                    ctx.moveTo(startX, startY);
                    ctx.bezierCurveTo(startX, midY, endX, midY, endX, endY);
                    ctx.stroke();

                    drawNode(child);
                });
            }

            // Skip drawing virtual root
            if (node.isVirtual) return;

            const isHovered = hoveredNode && hoveredNode.id === node.id;

            // Draw node background (rounded rectangle)
            const radius = 8;
            ctx.fillStyle = isHovered ? colors.hoverBg : colors.nodeBg;
            ctx.strokeStyle = isHovered ? colors.hoverBorder : colors.nodeBorder;
            ctx.lineWidth = isHovered ? 2 : 1;

            ctx.beginPath();
            ctx.moveTo(node.x + radius, node.y);
            ctx.lineTo(node.x + node.width - radius, node.y);
            ctx.quadraticCurveTo(node.x + node.width, node.y, node.x + node.width, node.y + radius);
            ctx.lineTo(node.x + node.width, node.y + node.height - radius);
            ctx.quadraticCurveTo(node.x + node.width, node.y + node.height, node.x + node.width - radius, node.y + node.height);
            ctx.lineTo(node.x + radius, node.y + node.height);
            ctx.quadraticCurveTo(node.x, node.y + node.height, node.x, node.y + node.height - radius);
            ctx.lineTo(node.x, node.y + radius);
            ctx.quadraticCurveTo(node.x, node.y, node.x + radius, node.y);
            ctx.closePath();

            // Shadow for depth
            if (!isDarkMode) {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetY = 4;
            }

            ctx.fill();
            ctx.stroke();

            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            // Draw text (Name)
            ctx.fillStyle = colors.nodeText;
            ctx.font = 'bold 14px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Truncate long names
            let name = node.name;
            if (ctx.measureText(name).width > node.width - 20) {
                while (ctx.measureText(name + '...').width > node.width - 20 && name.length > 0) {
                    name = name.slice(0, -1);
                }
                name += '...';
            }
            ctx.fillText(name, node.x + node.width / 2, node.y + node.height / 2 - 10);

            // Draw text (Role)
            ctx.fillStyle = colors.nodeSubtext;
            ctx.font = '12px Inter, system-ui, sans-serif';

            let role = node.role;
            if (ctx.measureText(role).width > node.width - 20) {
                while (ctx.measureText(role + '...').width > node.width - 20 && role.length > 0) {
                    role = role.slice(0, -1);
                }
                role += '...';
            }
            ctx.fillText(role, node.x + node.width / 2, node.y + node.height / 2 + 10);
        }

        drawNode(treeDataRef.current);
        ctx.restore();
    }, [offset, scale, hoveredNode, isDarkMode]);

    // Trigger render on state changes
    useEffect(() => {
        animationFrameRef.current = requestAnimationFrame(render);
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [render]);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => render();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [render]);

    /**
     * Mouse event handlers for pan and zoom
     */
    const handleMouseDown = (e) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e) => {
        if (isDragging) {
            setOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        } else {
            // Hit detection for hover
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - offset.x) / scale;
            const mouseY = (e.clientY - rect.top - offset.y) / scale;

            // Simple bounding box hit test
            let found = null;
            function hitTest(node) {
                if (!node || node.isVirtual) return;
                if (
                    mouseX >= node.x && mouseX <= node.x + node.width &&
                    mouseY >= node.y && mouseY <= node.y + node.height
                ) {
                    found = node;
                    return;
                }
                if (node.children) {
                    node.children.forEach(hitTest);
                }
            }
            if (treeDataRef.current) hitTest(treeDataRef.current);
            setHoveredNode(found);
            canvas.style.cursor = found ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * zoomIntensity);

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom towards mouse pointer
        const newScale = Math.min(Math.max(0.1, scale * zoom), 3);
        const newX = mouseX - (mouseX - offset.x) * (newScale / scale);
        const newY = mouseY - (mouseY - offset.y) * (newScale / scale);

        setScale(newScale);
        setOffset({ x: newX, y: newY });
    };

    const handleZoomIn = () => setScale(s => Math.min(3, s * 1.2));
    const handleZoomOut = () => setScale(s => Math.max(0.1, s / 1.2));

    const handleCenter = () => {
        if (!treeDataRef.current || !containerRef.current) return;
        const bounds = getTreeBounds(treeDataRef.current);
        const container = containerRef.current;
        const centerX = (container.clientWidth - bounds.width * scale) / 2 - bounds.minX * scale;
        const centerY = (container.clientHeight - bounds.height * scale) / 2 - bounds.minY * scale;
        setOffset({ x: centerX, y: centerY });
    };

    if (!employees || employees.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                <p className="text-gray-500 dark:text-slate-400">No employee data available to render org chart.</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[600px] bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden" ref={containerRef}>
            <canvas
                ref={canvasRef}
                className="w-full h-full touch-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            />

            {/* Controls Overlay */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 p-1">
                <button
                    onClick={handleZoomIn}
                    className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                    aria-label="Zoom In"
                >
                    <ZoomInIcon fontSize="small" />
                </button>
                <button
                    onClick={handleZoomOut}
                    className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                    aria-label="Zoom Out"
                >
                    <ZoomOutIcon fontSize="small" />
                </button>
                <div className="h-px bg-gray-200 dark:bg-slate-700" />
                <button
                    onClick={handleCenter}
                    className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                    aria-label="Center View"
                >
                    <CenterFocusStrongIcon fontSize="small" />
                </button>
            </div>

            {/* Scale Indicator */}
            <div className="absolute bottom-4 left-4 px-3 py-1 bg-white dark:bg-slate-800 rounded-md shadow border border-gray-200 dark:border-slate-700 text-xs text-gray-600 dark:text-slate-300">
                {Math.round(scale * 100)}%
            </div>
        </div>
    );
}

OrgChartCanvas.propTypes = {
    employees: PropTypes.arrayOf(PropTypes.object).isRequired,
};
