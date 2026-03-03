import { useState, useEffect, useCallback } from "react";
import { useCallbackRef } from "./useCallbackRef";

interface UseApiQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApiQuery<T>(
  fetcher: (() => Promise<T>) | null,
  deps?: unknown[],
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useCallbackRef(fetcher);

  const execute = useCallback(() => {
    const fn = fetcherRef.current;
    if (!fn) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    fn()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Something went wrong";
        setError(message);
      })
      .finally(() => { setIsLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcherRef is a stable ref, deps is forwarded from caller
  }, deps ?? []);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, isLoading, error, refetch: execute };
}
