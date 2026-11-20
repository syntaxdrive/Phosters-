import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-phosters-600 text-white hover:bg-phosters-700 active:bg-phosters-800 border border-transparent',
  secondary:
    'bg-white text-slate-900 hover:bg-slate-50 active:bg-slate-100 border border-slate-200',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 border border-transparent',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  md: 'min-h-[44px] px-4 py-2 text-sm font-semibold',
  lg: 'min-h-[48px] px-5 py-3 text-base font-semibold',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors duration-150',
        'whitespace-nowrap shrink-0 cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-phosters-600',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      )}
      <span>{children}</span>
    </button>
  );
}
