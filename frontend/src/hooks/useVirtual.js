import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Custom hook for virtualization
 * @param {Object} options
 * @param {number} options.itemCount - Total number of items in the list
 * @param {number} options.itemHeight - Height of each item in pixels
 * @param {number} options.overscan - Number of items to render above/below the visible area
 * @returns {Object} { virtualItems, totalHeight, startIndex, endIndex, containerRef }
 */
export default function useVirtual({ itemCount, itemHeight = 60, overscan = 5 }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400); // default height
  const containerRef = useRef(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleScroll = () => {
      setScrollTop(element.scrollTop);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // Fallback to clientHeight if contentRect height is 0
        setContainerHeight(entry.contentRect.height || element.clientHeight || 400);
      }
    });

    resizeObserver.observe(element);
    element.addEventListener('scroll', handleScroll, { passive: true });
    
    // Set initial values
    setScrollTop(element.scrollTop);
    setContainerHeight(element.clientHeight || 400);

    return () => {
      element.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [itemCount]);

  const { startIndex, endIndex, virtualItems } = useMemo(() => {
    const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIdx = Math.min(
      itemCount - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const items = [];
    for (let i = startIdx; i <= endIdx; i++) {
      items.push({
        index: i,
        offsetTop: i * itemHeight,
      });
    }

    return {
      startIndex: startIdx,
      endIndex: endIdx,
      virtualItems: items,
    };
  }, [scrollTop, containerHeight, itemCount, itemHeight, overscan]);

  return {
    virtualItems,
    startIndex,
    endIndex,
    containerRef,
  };
}
