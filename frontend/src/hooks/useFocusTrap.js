/**
 * @fileoverview Focus Trap Hook
 * @description A custom React hook that traps keyboard focus within a specific DOM node.
 * Ensures WCAG 2.1 AA compliance for modals and dialogs by preventing Tab navigation
 * from escaping the container. Returns focus to the trigger element upon unmount.
 * 
 * Issue: #1020
 */
import { useEffect, useRef, useCallback } from 'react';

/**
 * Selector for all natively focusable elements.
 */
const FOCUSABLE_SELECTORS = [
    'a[href]',
    'area[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    'iframe',
    'object',
    'embed',
    '[contenteditable]',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Custom hook to trap focus within a container.
 * 
 * @param {boolean} isOpen - Whether the modal/dialog is currently open.
 * @param {Object} options - Configuration options.
 * @param {boolean} options.returnFocus - Whether to return focus to the trigger on close.
 * @param {boolean} options.lockScroll - Whether to lock body scroll when open.
 * @returns {React.RefObject} Ref to attach to the container element.
 */
export function useFocusTrap(isOpen, options = {}) {
    const { returnFocus = true, lockScroll = true } = options;
    const containerRef = useRef(null);
    const previousActiveElementRef = useRef(null);

    /**
     * Handles the Tab and Shift+Tab keydown events to wrap focus.
     */
    const handleKeyDown = useCallback((event) => {
        if (event.key !== 'Tab' || !containerRef.current) return;

        const focusableElements = Array.from(
            containerRef.current.querySelectorAll(FOCUSABLE_SELECTORS)
        ).filter(el => {
            // Filter out elements that are visually hidden or have 0 dimensions
            return el.offsetParent !== null || el.getClientRects().length > 0;
        });

        if (focusableElements.length === 0) {
            event.preventDefault();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift + Tab (Backward)
        if (event.shiftKey) {
            if (document.activeElement === firstElement || !containerRef.current.contains(document.activeElement)) {
                lastElement.focus();
                event.preventDefault();
            }
        }
        // Tab (Forward)
        else {
            if (document.activeElement === lastElement || !containerRef.current.contains(document.activeElement)) {
                firstElement.focus();
                event.preventDefault();
            }
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            // Store the element that triggered the modal to return focus later
            previousActiveElementRef.current = document.activeElement;

            // Lock body scroll if requested
            if (lockScroll) {
                const originalOverflow = document.body.style.overflow;
                const originalPaddingRight = document.body.style.paddingRight;

                // Calculate scrollbar width to prevent layout shift
                const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

                document.body.style.overflow = 'hidden';
                if (scrollBarWidth > 0) {
                    document.body.style.paddingRight = `${scrollBarWidth}px`;
                }

                // Cleanup scroll lock
                return () => {
                    document.body.style.overflow = originalOverflow;
                    document.body.style.paddingRight = originalPaddingRight;
                };
            }
        }
    }, [isOpen, lockScroll]);

    useEffect(() => {
        const container = containerRef.current;
        if (!isOpen || !container) return;

        // Add keydown listener for focus trapping
        document.addEventListener('keydown', handleKeyDown);

        // Initial focus: Focus the first focusable element or the container itself
        requestAnimationFrame(() => {
            const focusableElements = container.querySelectorAll(FOCUSABLE_SELECTORS);
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            } else {
                // If no focusable elements, focus the container (requires tabIndex={-1})
                container.setAttribute('tabindex', '-1');
                container.focus();
            }
        });

        return () => {
            document.removeEventListener('keydown', handleKeyDown);

            // Return focus to the trigger element
            if (returnFocus && previousActiveElementRef.current) {
                requestAnimationFrame(() => {
                    if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
                        previousActiveElementRef.current.focus();
                    }
                });
            }
        };
    }, [isOpen, handleKeyDown, returnFocus]);

    return containerRef;
}
