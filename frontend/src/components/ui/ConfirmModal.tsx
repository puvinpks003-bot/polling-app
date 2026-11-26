import React from 'react';
import { AlertCircle, Trash2, Play, CheckCircle2, X, Loader2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'success';
  itemName?: string;
  itemBadge?: string;
  infoCallout?: string;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  itemName,
  itemBadge,
  infoCallout,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    warning: {
      glow: 'from-amber-500/15 via-amber-500/5 to-transparent',
      iconBox: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10',
      btn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/25 active:bg-amber-700',
      icon: <AlertCircle className="w-6 h-6" />,
      callout: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    },
    danger: {
      glow: 'from-rose-500/15 via-rose-500/5 to-transparent',
      iconBox: 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/10',
      btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/25 active:bg-rose-700',
      icon: <Trash2 className="w-6 h-6" />,
      callout: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
    },
    primary: {
      glow: 'from-blue-500/15 via-blue-500/5 to-transparent',
      iconBox: 'bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/10',
      btn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 active:bg-blue-700',
      icon: <Play className="w-6 h-6" />,
      callout: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    },
    success: {
      glow: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      iconBox: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10',
      btn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 active:bg-emerald-700',
      icon: <CheckCircle2 className="w-6 h-6" />,
      callout: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    },
  };

  const style = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Subtle Ambient Radial Glow */}
        <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${style.glow} pointer-events-none`} />

        {/* Modal Header */}
        <div className="p-6 relative">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="absolute right-5 top-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl shrink-0 ${style.iconBox}`}>
              {style.icon}
            </div>
            <div className="space-y-1 pr-6">
              <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Target Item Name Display */}
          {itemName && (
            <div className="mt-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400 font-medium truncate">
                Target: <strong className="text-white">{itemName}</strong>
              </span>
              {itemBadge && (
                <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  {itemBadge}
                </span>
              )}
            </div>
          )}

          {/* Info Callout */}
          {infoCallout && (
            <div className={`mt-3 p-3 rounded-xl border text-xs leading-relaxed ${style.callout}`}>
              {infoCallout}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 px-6 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 ${style.btn}`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
