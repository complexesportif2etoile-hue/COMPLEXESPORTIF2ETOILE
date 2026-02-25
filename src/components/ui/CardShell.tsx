import React from 'react';

interface CardShellProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-2.5 xs:p-3 sm:p-4',
  md: 'p-3 xs:p-4 sm:p-5',
  lg: 'p-4 xs:p-5 sm:p-6',
};

export const CardShell: React.FC<CardShellProps> = ({
  children,
  className = '',
  hover = false,
  padding = 'lg',
}) => {
  return (
    <div
      className={[
        'bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/60 shadow-sm shadow-black/10',
        paddingMap[padding],
        hover
          ? 'transition-all duration-200 hover:border-slate-600/70 hover:shadow-md hover:shadow-black/20 hover:-translate-y-[1px]'
          : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
};
