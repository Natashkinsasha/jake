"use client";

import { useState, useEffect, useCallback } from "react";
import { useCallbackRef } from "./useCallbackRef";

interface UseTabFocusOptions {
  onFocus?: () => void;
  onBlur?: () => void;
}

interface UseTabFocusReturn {
  isFocused: boolean;
}

export function useTabFocus(options?: UseTabFocusOptions): UseTabFocusReturn {
  const [isFocused, setIsFocused] = useState(true);
  const optionsRef = useCallbackRef(options);

  const handleVisibilityChange = useCallback(() => {
    const focused = !document.hidden;
    setIsFocused(focused);

    if (focused) {
      optionsRef.current?.onFocus?.();
    } else {
      optionsRef.current?.onBlur?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- optionsRef is a stable ref
  }, []);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  return { isFocused };
}
