import { useCallback, useRef } from "react";

/**
 * useDebounce: Hook for debouncing async function calls.
 * Prevents rapid repeated invocations within delay period.
 */
export function useDebounce(callback, delayMs = 1000) {
  const timerRef = useRef(null);

  const debouncedCallback = useCallback(
    (...args) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callback(...args);
      }, delayMs);
    },
    [callback, delayMs]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return [debouncedCallback, cancel];
}
