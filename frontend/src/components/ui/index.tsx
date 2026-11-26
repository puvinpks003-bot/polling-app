import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Button Component
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}) => {
  const base = "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 rounded-lg cursor-pointer";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20 active:bg-blue-700",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700",
    outline: "border border-slate-700 text-slate-200 hover:bg-slate-800/80 hover:text-white",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20",
    ghost: "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs gap-1.5",
    md: "h-10 px-4 text-sm gap-2",
    lg: "h-12 px-6 text-base gap-2.5",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
      {children}
    </button>
  );
};

// Card Component
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("bg-slate-900/80 border border-slate-800/90 rounded-xl p-5 shadow-sm backdrop-blur-sm", className)}>
    {children}
  </div>
);

// Badge Component
export const Badge: React.FC<{
  children: React.ReactNode;
  variant?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' | 'purple';
  className?: string;
}> = ({ children, variant = 'blue', className }) => {
  const variants = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    slate: "bg-slate-800 text-slate-300 border-slate-700",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };

  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", variants[variant], className)}>
      {children}
    </span>
  );
};

// Input Component
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, helperText, className, id, ...props }) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors",
          error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-400">{helperText}</p>}
    </div>
  );
};

// Modal Dialog Component
export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ isOpen, onClose, title, description, children, maxWidth = 'md' }) => {
  if (!isOpen) return null;

  const widths = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className={cn("w-full bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 p-6 relative overflow-hidden animate-in zoom-in-95 duration-150", widths[maxWidth])}>
        {/* Subtle Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-blue-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80 relative">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 relative">{children}</div>
      </div>
    </div>
  );
};

// Loading Skeleton
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("animate-pulse bg-slate-800/60 rounded-md", className)} />
);

export { CategoryCombobox } from './CategoryCombobox';
export { ConfirmModal } from './ConfirmModal';
export type { ConfirmModalProps } from './ConfirmModal';

