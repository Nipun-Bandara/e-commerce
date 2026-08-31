"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleCheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Transient messages, bottom-right.
 *
 * Written here rather than pulled in from `sonner` (shadcn's usual toaster):
 * that package brings `next-themes` with it, and this app has no theme
 * provider — dark mode is the plain `.dark` variant declared in globals.css.
 * A queue, a timer and an aria-live region is the whole feature, so owning it
 * costs less than owning the dependency.
 *
 * The list is one `role="status"` region rather than one per toast, so a screen
 * reader announces messages as they arrive without re-announcing the rest.
 */

export type ToastVariant = "success" | "error";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ShowToast = (message: string, variant?: ToastVariant) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** Long enough to read a sentence, short enough not to stack up. */
const TOAST_DURATION_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (message, variant = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      );
    },
    [dismiss],
  );

  // Timers outlive the component if the page navigates away mid-toast, and a
  // callback firing into an unmounted tree is a leak plus a React warning.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}

      <div
        role="status"
        aria-live="polite"
        // `pointer-events-none` on the stack, restored on each toast: an empty
        // region must not swallow clicks on whatever sits under it.
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            onDismiss={() => dismiss(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const isError = toast.variant === "error";
  const Icon = isError ? TriangleAlertIcon : CircleCheckIcon;

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm shadow-lg",
        "animate-in fade-in slide-in-from-bottom-2",
        isError ? "border-destructive/40 text-destructive" : "border-border",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="flex-1 leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <XIcon className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return show;
}
