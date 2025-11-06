
'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook for implementing keyboard navigation
 * Supports arrow keys, Enter, and Escape
 */
export function useKeyboardNavigation(
  items: any[],
  onSelect: (index: number) => void,
  options: {
    enabled?: boolean;
    orientation?: 'horizontal' | 'vertical';
    loop?: boolean;
  } = {}
) {
  const { enabled = true, orientation = 'vertical', loop = true } = options;
  const currentIndexRef = useRef(0);

  useEffect(() => {
    if (!enabled || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
      const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';

      if (e.key === nextKey) {
        e.preventDefault();
        currentIndexRef.current = loop
          ? (currentIndexRef.current + 1) % items.length
          : Math.min(currentIndexRef.current + 1, items.length - 1);
        onSelect(currentIndexRef.current);
      } else if (e.key === prevKey) {
        e.preventDefault();
        currentIndexRef.current = loop
          ? currentIndexRef.current === 0
            ? items.length - 1
            : currentIndexRef.current - 1
          : Math.max(currentIndexRef.current - 1, 0);
        onSelect(currentIndexRef.current);
      } else if (e.key === 'Home') {
        e.preventDefault();
        currentIndexRef.current = 0;
        onSelect(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        currentIndexRef.current = items.length - 1;
        onSelect(items.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, onSelect, enabled, orientation, loop]);

  return currentIndexRef;
}
