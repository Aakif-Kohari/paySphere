/**
 * @fileoverview Mobile Detection Hook
 * @description Listens to window resize events and media queries to determine 
 * if the current viewport is considered "mobile" (under 768px).
 * 
 * Issue: #1025
 */
import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Hook to detect if the screen is mobile-sized.
 * @returns {boolean} True if viewport width < 768px
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
    );

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        // Use matchMedia for better performance and accuracy
        const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

        const handleChange = (e) => {
            setIsMobile(e.matches);
        };

        // Set initial value
        setIsMobile(mediaQuery.matches);

        // Add listeners
        mediaQuery.addEventListener('change', handleChange);
        window.addEventListener('resize', handleResize);

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return isMobile;
}
