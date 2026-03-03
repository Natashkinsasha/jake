import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApiQuery<T>(
  fetcher: (() => Promise<T>) | null,
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

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
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, isLoading, error, refetch: execute };
}
