'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastActionProps {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

export interface ToastData {
  icon?: React.ReactNode;
  [key: string]: unknown;
}

export interface ToastOptions<T = ToastData> {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  timeout?: number; // ms, 0 = persistent, default 5000
  type?: ToastType;
  priority?: 'low' | 'high';
  data?: T;
  actionProps?: ToastActionProps;
  onClose?: () => void;
}

export interface ToastObject<T = ToastData> extends ToastOptions<T> {
  id: string;
  createdAt: number;
}

export interface ToastPromiseStates<T = unknown> {
  loading: {
    title: React.ReactNode;
    description?: React.ReactNode;
    data?: ToastData;
  };
  success:
    | {
        title: React.ReactNode;
        description?: React.ReactNode;
        data?: ToastData;
      }
    | ((data: T) => {
        title: React.ReactNode;
        description?: React.ReactNode;
        data?: ToastData;
      });
  error:
    | {
        title: React.ReactNode;
        description?: React.ReactNode;
        data?: ToastData;
      }
    | ((error: unknown) => {
        title: React.ReactNode;
        description?: React.ReactNode;
        data?: ToastData;
      });
}

export interface ToastManager<T = ToastData> {
  toasts: ToastObject<T>[];
  add: (options: ToastOptions<T>) => string;
  update: (id: string, options: Partial<ToastOptions<T>>) => void;
  close: (id: string) => void;
  dismissAll: () => void;
  promise: <P>(promise: Promise<P>, states: ToastPromiseStates<P>) => Promise<P>;
  success: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<ToastOptions<T>>) => string;
  error: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<ToastOptions<T>>) => string;
  warning: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<ToastOptions<T>>) => string;
  info: (title: React.ReactNode, description?: React.ReactNode, options?: Partial<ToastOptions<T>>) => string;
}

const ToastContext = React.createContext<ToastManager | null>(null);

export interface ToastProviderProps {
  children: React.ReactNode;
  timeout?: number;
  limit?: number;
}

export function ToastProvider({
  children,
  timeout = 5000,
  limit = 5,
}: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastObject[]>([]);

  const close = React.useCallback((id: string) => {
    setToasts((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target?.onClose) {
        try {
          target.onClose();
        } catch {
          // ignore
        }
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const dismissAll = React.useCallback(() => {
    setToasts([]);
  }, []);

  const update = React.useCallback((id: string, options: Partial<ToastOptions>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...options } : t))
    );
  }, []);

  const add = React.useCallback(
    (options: ToastOptions): string => {
      const id = options.id || Math.random().toString(36).substring(2, 9);
      const newToast: ToastObject = {
        timeout,
        priority: 'low',
        type: 'default',
        ...options,
        id,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        const next = [...filtered, newToast];
        if (limit && next.length > limit) {
          return next.slice(next.length - limit);
        }
        return next;
      });

      return id;
    },
    [timeout, limit]
  );

  const success = React.useCallback(
    (title: React.ReactNode, description?: React.ReactNode, options?: Partial<ToastOptions>): string => {
      return add({
        title,
        description,
        type: 'success',
        data: {
          icon: (
            <Thumbnail variant="icon-success" size="sm">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            </Thumbnail>
          ),
          ...options?.data,
        },
        ...options,
      });
    },
    [add]
  );

  const error = React.useCallback(
    (title: React.ReactNode, description?: React.ReactNode, options?: Partial<ToastOptions>): string => {
      return add({
        title,
        description,
        type: 'error',
        priority: 'high',
        data: {
          icon: (
            <Thumbnail variant="icon-error" size="sm">
              <XCircle className="size-4 text-rose-600 dark:text-rose-400" />
            </Thumbnail>
          ),
          ...options?.data,
        },
        ...options,
      });
    },
    [add]
  );

  const warning = React.useCallback(
    (title: React.ReactNode, description?: React.ReactNode, options?: Partial<ToastOptions>): string => {
      return add({
        title,
        description,
        type: 'warning',
        priority: 'high',
        data: {
          icon: (
            <Thumbnail variant="icon-warning" size="sm">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            </Thumbnail>
          ),
          ...options?.data,
        },
        ...options,
      });
    },
    [add]
  );

  const info = React.useCallback(
    (title: React.ReactNode, description?: React.ReactNode, options?: Partial<ToastOptions>): string => {
      return add({
        title,
        description,
        type: 'info',
        data: {
          icon: (
            <Thumbnail variant="icon-info" size="sm">
              <Info className="size-4 text-sky-600 dark:text-sky-400" />
            </Thumbnail>
          ),
          ...options?.data,
        },
        ...options,
      });
    },
    [add]
  );

  const promise = React.useCallback(
    async <P,>(p: Promise<P>, states: ToastPromiseStates<P>): Promise<P> => {
      const toastId = add({
        title: states.loading.title,
        description: states.loading.description,
        timeout: 0,
        type: 'default',
        data: {
          icon: (
            <Thumbnail variant="icon-soft" size="sm">
              <Loader2 className="size-4 animate-spin text-slate-600 dark:text-slate-300" />
            </Thumbnail>
          ),
          ...states.loading.data,
        },
      });

      try {
        const result = await p;
        const successState =
          typeof states.success === 'function'
            ? states.success(result)
            : states.success;

        update(toastId, {
          title: successState.title,
          description: successState.description,
          type: 'success',
          timeout,
          data: {
            icon: (
              <Thumbnail variant="icon-success" size="sm">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              </Thumbnail>
            ),
            ...successState.data,
          },
        });
        return result;
      } catch (err) {
        const errorState =
          typeof states.error === 'function' ? states.error(err) : states.error;

        update(toastId, {
          title: errorState.title,
          description: errorState.description,
          type: 'error',
          priority: 'high',
          timeout,
          data: {
            icon: (
              <Thumbnail variant="icon-error" size="sm">
                <XCircle className="size-4 text-rose-600 dark:text-rose-400" />
              </Thumbnail>
            ),
            ...errorState.data,
          },
        });
        throw err;
      }
    },
    [add, update, timeout]
  );

  const manager = React.useMemo<ToastManager>(
    () => ({
      toasts,
      add,
      update,
      close,
      dismissAll,
      promise,
      success,
      error,
      warning,
      info,
    }),
    [toasts, add, update, close, dismissAll, promise, success, error, warning, info]
  );

  return (
    <ToastContext.Provider value={manager}>{children}</ToastContext.Provider>
  );
}

export function useToastManager<T = ToastData>(): ToastManager<T> {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastManager must be used within a ToastProvider');
  }
  return ctx as unknown as ToastManager<T>;
}

export interface ThumbnailProps {
  children: React.ReactNode;
  variant?: 'icon-soft' | 'icon-success' | 'icon-error' | 'icon-warning' | 'icon-info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Thumbnail({
  children,
  variant = 'icon-soft',
  size = 'sm',
  className = '',
}: ThumbnailProps) {
  const variantStyles = {
    'icon-soft': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    'icon-success': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 ring-1 ring-emerald-500/20',
    'icon-error': 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 ring-1 ring-rose-500/20',
    'icon-warning': 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-500/20',
    'icon-info': 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 ring-1 ring-sky-500/20',
  }[variant];

  const sizeStyles = {
    sm: 'size-8 rounded-xl',
    md: 'size-9 rounded-xl',
    lg: 'size-10 rounded-2xl',
  }[size];

  return (
    <div
      className={`flex shrink-0 items-center justify-center transition-colors ${sizeStyles} ${variantStyles} ${className}`}
    >
      {children}
    </div>
  );
}

export interface ToasterProps {
  position?: ToastPosition;
  progress?: boolean;
  timeout?: number;
  className?: string;
}

export function Toaster({
  position = 'bottom-right',
  progress = true,
  timeout = 5000,
  className = '',
}: ToasterProps) {
  const { toasts, close } = useToastManager();

  const positionClasses: Record<ToastPosition, string> = {
    'top-left': 'top-4 left-4 items-start',
    'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
    'top-right': 'top-4 right-4 items-end',
    'bottom-left': 'bottom-4 left-4 items-start',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
    'bottom-right': 'bottom-4 right-4 items-end',
  };

  const isTop = position.startsWith('top');

  return (
    <div
      tabIndex={-1}
      aria-live="polite"
      className={`fixed z-9999 pointer-events-none flex flex-col gap-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md ${positionClasses[position]} ${className}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            position={position}
            showProgress={progress}
            defaultTimeout={timeout}
            onClose={() => close(toast.id)}
            isTop={isTop}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({
  toast,
  showProgress,
  defaultTimeout,
  onClose,
  isTop,
}: {
  toast: ToastObject;
  position: ToastPosition;
  showProgress: boolean;
  defaultTimeout: number;
  onClose: () => void;
  isTop: boolean;
}) {
  const effectiveTimeout =
    typeof toast.timeout === 'number' ? toast.timeout : defaultTimeout;

  React.useEffect(() => {
    if (effectiveTimeout <= 0) return;
    const timer = setTimeout(() => {
      onClose();
    }, effectiveTimeout);
    return () => clearTimeout(timer);
  }, [effectiveTimeout, onClose]);

  const rawIcon = toast.data?.icon;
  const renderIcon = () => {
    if (rawIcon) return rawIcon;
    if (toast.type === 'success') {
      return (
        <Thumbnail variant="icon-success" size="sm">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
        </Thumbnail>
      );
    }
    if (toast.type === 'error') {
      return (
        <Thumbnail variant="icon-error" size="sm">
          <XCircle className="size-4 text-rose-600 dark:text-rose-400" />
        </Thumbnail>
      );
    }
    if (toast.type === 'warning') {
      return (
        <Thumbnail variant="icon-warning" size="sm">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
        </Thumbnail>
      );
    }
    if (toast.type === 'info') {
      return (
        <Thumbnail variant="icon-info" size="sm">
          <Info className="size-4 text-sky-600 dark:text-sky-400" />
        </Thumbnail>
      );
    }
    return null;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: isTop ? -16 : 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: isTop ? -12 : 12, scale: 0.94 }}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      role={toast.priority === 'high' ? 'alert' : 'status'}
      className="pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-xl backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/95 sm:min-w-[340px]"
    >
      <div className="flex items-start gap-3">
        {renderIcon()}

        <div className="flex-1 min-w-0 pt-0.5">
          {toast.title ? (
            <h5 className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">
              {toast.title}
            </h5>
          ) : null}

          {toast.description ? (
            <div className="mt-1 text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-400">
              {toast.description}
            </div>
          ) : null}

          {toast.actionProps ? (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => toast.actionProps?.onClick(e)}
                className={`inline-flex h-7 items-center justify-center rounded-lg bg-slate-900 px-3 text-[11px] font-bold text-white shadow-2xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 ${toast.actionProps.className || ''}`}
              >
                {toast.actionProps.children}
              </button>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 -mr-1 -mt-1 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {showProgress && effectiveTimeout > 0 ? (
        <div className="absolute bottom-0 inset-x-0 h-0.5 bg-slate-100 dark:bg-slate-800/60 overflow-hidden">
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: effectiveTimeout / 1000, ease: 'linear' }}
            className={`h-full w-full origin-right ${
              toast.type === 'success'
                ? 'bg-emerald-500'
                : toast.type === 'error'
                ? 'bg-rose-500'
                : toast.type === 'warning'
                ? 'bg-amber-500'
                : toast.type === 'info'
                ? 'bg-sky-500'
                : 'bg-amber-500'
            }`}
          />
        </div>
      ) : null}
    </motion.div>
  );
}
