import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const VARIANTS = {
  primary:   'bg-(--color-zion-purple) hover:bg-(--color-zion-purple-dim) text-white',
  secondary: 'bg-(--color-bg-hover) hover:bg-(--color-border) text-(--color-text)',
  danger:    'bg-red-800 hover:bg-red-700 text-white',
  ghost:     'hover:bg-(--color-bg-hover) text-(--color-text-muted) hover:text-(--color-text)',
};

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-1.5 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({ variant = 'secondary', size = 'md', loading, disabled, children, className = '', ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 rounded-md font-medium transition-all border border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-zion-purple)/50 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin h-3 w-3 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  );
}
