import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const VARIANTS = {
  primary:   'zion-btn-primary',
  secondary: 'zion-btn-secondary',
  danger:    'inline-flex items-center justify-content-center gap-2 rounded-[var(--zion-radius-md)] bg-red-800/70 hover:bg-red-700/80 text-white border border-red-700/50 backdrop-blur-sm transition-all font-semibold',
  ghost:     'inline-flex items-center gap-2 rounded-[var(--zion-radius-sm)] hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-all font-medium',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const overridePadding = isPrimary || isSecondary ? SIZES[size] : '';

  return (
    <button
      disabled={disabled || loading}
      className={`
        ${VARIANTS[variant]}
        ${overridePadding}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(6,182,212,0.7)]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...rest}
    >
      {loading && (
        <svg
          className="animate-spin h-3.5 w-3.5 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  );
}
