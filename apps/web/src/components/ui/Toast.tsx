"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { TOAST_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {
    // no-op
  },
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_CONFIG.DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={useMemo(() => ({ showToast }), [showToast])}>
      {children}
      <div className="fixed bottom-20 right-4 z-50 space-y-2 lg:bottom-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up",
              toast.type === "success" && "bg-green-500 text-white",
              toast.type === "error" && "bg-red-500 text-white",
              toast.type === "info" && "bg-gray-800 text-white",
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
