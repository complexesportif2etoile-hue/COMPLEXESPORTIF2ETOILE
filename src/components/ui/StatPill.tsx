import React from 'react';

interface StatPillProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  trend?: 'positive' | 'active' | 'neutral';
  badge?: string;
}

export const StatPill: React.FC<StatPillProps> = ({
  label,
  value,
  icon,
  iconBg = 'bg-slate-700/50',
  iconColor = 'text-slate-400',
  trend = 'neutral',
  badge,
}) => {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl xs:rounded-2xl border border-slate-700/60 shadow-sm shadow-black/10 p-3 xs:p-4 sm:p-5 transition-all duration-200 hover:border-slate-600/70 hover:shadow-md hover:shadow-black/20 hover:-translate-y-[1px] group">
      <div className="flex items-center justify-between mb-2 xs:mb-3 sm:mb-4">
        {icon && (
          <div className={`h-8 w-8 xs:h-10 xs:w-10 lg:h-11 lg:w-11 rounded-full border ring-1 ring-white/5 inline-flex items-center justify-center ${iconBg} border-slate-700/50 ${iconColor} shrink-0`}>
            <div className="scale-90 xs:scale-100">{icon}</div>
          </div>
        )}
        <div className="flex items-center gap-1.5 xs:gap-2">
          {badge && (
            <span className="text-[9px] xs:text-[10px] font-semibold uppercase tracking-wider px-1.5 xs:px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {badge}
            </span>
          )}
          {trend === 'active' && (
            <div className="relative flex h-2.5 w-2.5 xs:h-3 xs:w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 xs:h-3 xs:w-3 bg-rose-500" />
            </div>
          )}
        </div>
      </div>
      <p className="text-lg xs:text-xl sm:text-2xl font-bold text-white tracking-tight truncate">{value}</p>
      <p className="text-[9px] xs:text-[10px] sm:text-xs text-slate-500 mt-0.5 xs:mt-1 font-semibold uppercase tracking-wider truncate">{label}</p>
    </div>
  );
};
