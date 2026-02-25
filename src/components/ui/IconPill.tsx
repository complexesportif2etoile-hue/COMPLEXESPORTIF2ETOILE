import React from 'react';

type Variant = 'default' | 'primary' | 'success' | 'warn' | 'danger';
type Size = 'sm' | 'md';

interface IconPillProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  'aria-label'?: string;
}

const variantStyles: Record<Variant, { base: string; hover: string }> = {
  default: {
    base: 'bg-slate-900/60 border-slate-700/50 ring-white/5 text-slate-400',
    hover: 'hover:bg-slate-800/80 hover:text-slate-200 hover:border-slate-600/60 hover:shadow-lg hover:shadow-slate-900/40',
  },
  primary: {
    base: 'bg-emerald-500/10 border-emerald-500/20 ring-emerald-500/5 text-emerald-400',
    hover: 'hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10',
  },
  success: {
    base: 'bg-teal-500/10 border-teal-500/20 ring-teal-500/5 text-teal-400',
    hover: 'hover:bg-teal-500/20 hover:border-teal-500/30 hover:shadow-lg hover:shadow-teal-500/10',
  },
  warn: {
    base: 'bg-amber-500/10 border-amber-500/20 ring-amber-500/5 text-amber-400',
    hover: 'hover:bg-amber-500/20 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/10',
  },
  danger: {
    base: 'bg-red-500/10 border-red-500/20 ring-red-500/5 text-red-400',
    hover: 'hover:bg-red-500/20 hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/10',
  },
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10 lg:h-11 lg:w-11',
};

export const IconPill: React.FC<IconPillProps> = ({
  children,
  variant = 'default',
  size = 'md',
  onClick,
  disabled = false,
  className = '',
  title,
  ...rest
}) => {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const interactive = !!onClick;

  const classes = [
    'inline-flex items-center justify-center rounded-full border ring-1 transition-all duration-200',
    v.base,
    s,
    interactive && !disabled ? `${v.hover} cursor-pointer hover:-translate-y-[1px] active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500/40` : '',
    disabled ? 'opacity-40 cursor-not-allowed' : '',
    className,
  ].filter(Boolean).join(' ');

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={classes}
        title={title}
        aria-label={rest['aria-label'] || title}
      >
        {children}
      </button>
    );
  }

  return (
    <span className={classes} title={title} aria-label={rest['aria-label'] || title}>
      {children}
    </span>
  );
};
