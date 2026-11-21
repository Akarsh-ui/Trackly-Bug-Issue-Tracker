import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1F1E]/30 dark:bg-black/60 p-4"
      onClick={() => {
        if (!loading) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg bg-white dark:bg-[#201F1D] border border-[#DCD9D0] dark:border-[#3A3835] shadow-[0_12px_32px_rgba(31,31,30,0.08)]"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#E4E2DC] dark:border-[#2E2D2A]">
          <div className="flex items-center gap-2.5">
            {destructive && (
              <span className="w-8 h-8 rounded bg-[#FBEAE8] dark:bg-[#361E1C] text-[#B3473B] dark:text-[#EB8B80] inline-flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </span>
            )}
            <h3
              id="confirm-dialog-title"
              className="text-base font-semibold text-[#1F1F1E] dark:text-[#F3F0EE]"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded text-[#6B6964] hover:text-[#1F1F1E] dark:hover:text-[#F3F0EE] hover:bg-[#F4F3EE] dark:hover:bg-[#2A2926]"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[13px] leading-relaxed text-[#6B6964] dark:text-[#A8A49B]">
            {description}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-[#FAFAF8] dark:bg-[#1A1918] border-t border-[#E4E2DC] dark:border-[#2E2D2A] rounded-b-lg">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-medium rounded border border-[#E4E2DC] dark:border-[#3A3835] bg-white dark:bg-[#252422] text-[#1F1F1E] dark:text-[#F3F0EE] hover:bg-[#F7F6F2] dark:hover:bg-[#2E2D2A] transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-3.5 py-2 text-xs font-medium rounded text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${
              destructive
                ? 'bg-[#B3473B] hover:bg-[#99392E]'
                : 'bg-[#C56A45] hover:bg-[#B05B38]'
            }`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
