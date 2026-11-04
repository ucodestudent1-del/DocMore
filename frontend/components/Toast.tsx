"use client";

import { createContext, useContext, useCallback, useState, ReactNode } from "react";

type ToastVariant = "default" | "destructive";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextType {
  toast: (o: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((o: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const entry: Toast = { ...o, id };
    setToasts((prev) => [...prev, entry]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t, i) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-80 p-4 rounded-lg shadow-xl border animate-in slide-in-from-top-4 duration-200 ${
              t.variant === "destructive"
                ? "bg-red-50 border-red-200 text-red-900 dark:bg-red-900 dark:text-red-100"
                : "bg-white border-gray-200 text-gray-900 dark:bg-gray-800 dark:text-white"
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {t.title && <h4 className="font-semibold mb-1">{t.title}</h4>}
            {t.description && <p className="text-sm">{t.description}</p>}
            <button
              onClick={() => dismiss(t.id)}
              className="absolute top-2 right-2 opacity-40 hover:opacity-100"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
