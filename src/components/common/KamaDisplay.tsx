import React, { useState } from 'react';
import { formatKamasNumber } from '../../utils/kamaFormatters';

export type KamaVariant = 'amber' | 'purple' | 'emerald' | 'red' | 'profit' | 'slate' | 'white';

interface KamaDisplayProps {
  amount: number;
  showSign?: boolean;
  compact?: boolean;
  variant?: KamaVariant;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  className?: string;
  subText?: string;
}

export const KamaDisplay: React.FC<KamaDisplayProps> = ({
  amount,
  showSign = false,
  compact = false,
  variant = 'amber',
  size = 'sm',
  className = '',
  subText,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const info = formatKamasNumber(amount, { showSign, compact });

  // Determine text color based on variant
  let colorClass = 'text-amber-300';
  if (variant === 'purple') {
    colorClass = 'text-purple-300';
  } else if (variant === 'emerald') {
    colorClass = 'text-emerald-400';
  } else if (variant === 'red') {
    colorClass = 'text-red-400';
  } else if (variant === 'white') {
    colorClass = 'text-white';
  } else if (variant === 'slate') {
    colorClass = 'text-slate-300';
  } else if (variant === 'profit') {
    colorClass = amount >= 0 ? 'text-emerald-400' : 'text-red-400';
  }

  // Size classes
  let sizeClass = 'text-sm';
  if (size === 'xs') sizeClass = 'text-xs';
  else if (size === 'base') sizeClass = 'text-base';
  else if (size === 'lg') sizeClass = 'text-lg';
  else if (size === 'xl') sizeClass = 'text-xl';

  return (
    <div
      className={`relative inline-flex items-center gap-1 font-mono font-black tabular-nums ${colorClass} ${sizeClass} ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="whitespace-nowrap">{info.formatted}</span>
      {subText && <span className="text-[10px] font-normal text-slate-400">{subText}</span>}

      {/* Tooltip for compact/exact values */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-lg shadow-2xl z-50 whitespace-nowrap pointer-events-none">
          <span className="text-amber-400 font-bold">{Math.round(amount).toLocaleString('de-DE')}</span> Kamas
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
        </div>
      )}
    </div>
  );
};
