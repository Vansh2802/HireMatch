import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; tone: ToastTone; message: string };

const ToastContext = createContext<{ notify: (message: string, tone?: ToastTone) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((toast) => toast.id !== id)), []);
  const notify = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = nextId.current++;
      setToasts((items) => [...items.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ notify }), [notify]);

  const icons = { success: <CheckCircle2 size={16} className="text-met" />, error: <AlertCircle size={16} className="text-missing" />, info: <Info size={16} className="text-unknown" /> };
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:right-6" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm animate-enter items-start gap-2.5 rounded-md border border-line bg-paper px-3.5 py-3 text-sm shadow-pop">
            <span className="mt-0.5 shrink-0">{icons[toast.tone]}</span>
            <p className="flex-1 text-ink">{toast.message}</p>
            <button type="button" onClick={() => dismiss(toast.id)} className="shrink-0 rounded p-0.5 text-ink-faint hover:text-ink" aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context.notify;
}
