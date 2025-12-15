/**
 * ToastNotifications.ts
 * 
 * Centralized toast notification utilities for MinaID
 * Uses react-hot-toast for consistent UI feedback
 */

import toast from 'react-hot-toast';

export interface ToastOptions {
  duration?: number;
  icon?: string;
}

export const notify = {
  /**
   * Success notification
   */
  success: (message: string, options?: ToastOptions) => {
    return toast.success(message, {
      duration: options?.duration || 4000,
      icon: options?.icon || '✅',
      style: {
        background: '#10B981',
        color: '#fff',
        fontFamily: 'var(--font-monument)',
        fontSize: '0.875rem',
      },
    });
  },

  /**
   * Error notification
   */
  error: (message: string, options?: ToastOptions) => {
    return toast.error(message, {
      duration: options?.duration || 5000,
      icon: options?.icon || '❌',
      style: {
        background: '#EF4444',
        color: '#fff',
        fontFamily: 'var(--font-monument)',
        fontSize: '0.875rem',
      },
    });
  },

  /**
   * Info notification
   */
  info: (message: string, options?: ToastOptions) => {
    return toast(message, {
      duration: options?.duration || 3000,
      icon: options?.icon || 'ℹ️',
      style: {
        background: '#3B82F6',
        color: '#fff',
        fontFamily: 'var(--font-monument)',
        fontSize: '0.875rem',
      },
    });
  },

  /**
   * Warning notification
   */
  warning: (message: string, options?: ToastOptions) => {
    return toast(message, {
      duration: options?.duration || 4000,
      icon: options?.icon || '⚠️',
      style: {
        background: '#F59E0B',
        color: '#fff',
        fontFamily: 'var(--font-monument)',
        fontSize: '0.875rem',
      },
    });
  },

  /**
   * Loading notification (with promise)
   */
  loading: (message: string) => {
    return toast.loading(message, {
      style: {
        background: '#6B7280',
        color: '#fff',
        fontFamily: 'var(--font-monument)',
        fontSize: '0.875rem',
      },
    });
  },

  /**
   * Custom notification
   */
  custom: (message: string, options?: ToastOptions & { style?: React.CSSProperties }) => {
    return toast(message, {
      duration: options?.duration || 3000,
      icon: options?.icon,
      style: options?.style,
    });
  },

  /**
   * Promise-based notification
   * Shows loading, then success or error based on promise result
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: any) => string);
    },
    options?: ToastOptions
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        style: {
          fontFamily: 'var(--font-monument)',
          fontSize: '0.875rem',
        },
      }
    );
  },

  /**
   * Dismiss a specific toast or all toasts
   */
  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  },

  /**
   * Transaction notifications (specialized)
   */
  tx: {
    submitted: (hash: string) => {
      return notify.info(`Transaction submitted\n${hash.slice(0, 10)}...`, {
        icon: '📤',
        duration: 3000,
      });
    },
    
    pending: (message?: string) => {
      return notify.loading(message || 'Waiting for block inclusion...');
    },
    
    confirmed: (hash: string, confirmations: number) => {
      return notify.success(
        `Transaction confirmed!\n${confirmations} confirmation${confirmations > 1 ? 's' : ''}`,
        { icon: '✅', duration: 5000 }
      );
    },
    
    failed: (reason: string) => {
      return notify.error(`Transaction failed: ${reason}`, {
        duration: 7000,
      });
    },
  },

  /**
   * Proof generation notifications (specialized)
   */
  proof: {
    compiling: () => {
      return notify.loading('Compiling zero-knowledge circuit...');
    },
    
    generating: () => {
      return notify.loading('Generating zero-knowledge proof...');
    },
    
    complete: (proofType: string) => {
      return notify.success(`${proofType} proof generated!`, {
        icon: '🔐',
        duration: 4000,
      });
    },
  },
};
