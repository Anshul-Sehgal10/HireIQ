"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastCtx {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-success-border bg-success-bg text-success-foreground",
  error: "border-danger-border bg-danger-bg text-danger-foreground",
  info: "border-border bg-card text-foreground",
};

const ICON_CLASSES: Record<ToastVariant, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-primary",
};

/** Replaces raw alert() calls (ResumesPage, EmployerJobsPage,
 *  EmployerJobDetailModal, etc.) — wire in progressively during later steps. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "info", durationMs = 4000 }: ToastOptions) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      timers.current[id] = setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          // Fix hydration error here
          <div suppressHydrationWarning={true} className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
            {toasts.map((t) => {
              const Icon = ICONS[t.variant];
              return (
                <div
                  key={t.id}
                  role="status"
                  className={cn(
                    "pointer-events-auto flex animate-slide-over items-start gap-3 rounded-xl border p-4 shadow-lg",
                    VARIANT_CLASSES[t.variant],
                  )}
                >
                  <Icon size={18} className={cn("mt-0.5 shrink-0", ICON_CLASSES[t.variant])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{t.title}</p>
                    {t.description && <p className="mt-0.5 text-xs opacity-80">{t.description}</p>}
                  </div>
                  <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 opacity-60 transition-opacity hover:opacity-100">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);