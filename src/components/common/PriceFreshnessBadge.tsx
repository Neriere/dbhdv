import React from 'react';
import { formatRelativeTime } from '../../services/dofusDbService';

interface PriceFreshnessBadgeProps {
  updatedAt?: number | null;
  compact?: boolean;
  className?: string;
  showIcon?: boolean;
}

export const PriceFreshnessBadge: React.FC<PriceFreshnessBadgeProps> = ({
  updatedAt,
  compact = false,
  className = '',
}) => {
  if (!updatedAt || updatedAt <= 0) {
    return (
      <span
        title="Precio sin registrar o antiguo"
        className={`inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
        {!compact && <span>Sin fecha</span>}
      </span>
    );
  }

  const ageMs = Date.now() - updatedAt;
  const isLive = ageMs < 15 * 60 * 1000; // Under 15 minutes = Hot / Live from sniffer
  const isRecent = ageMs < 24 * 60 * 60 * 1000; // Under 24 hours

  const relativeText = formatRelativeTime(updatedAt);

  if (isLive) {
    return (
      <span
        title={`Precio reciente: ${relativeText}`}
        className={`inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 ${className}`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        {!compact ? <span>En vivo ({relativeText})</span> : null}
      </span>
    );
  }

  if (isRecent) {
    return (
      <span
        title={`Actualizado: ${relativeText}`}
        className={`inline-flex items-center gap-1 text-[10px] font-medium text-amber-400/90 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        {!compact && <span>{relativeText}</span>}
      </span>
    );
  }

  return (
    <span
      title={`Actualizado: ${relativeText}`}
      className={`inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
      {!compact && <span>{relativeText}</span>}
    </span>
  );
};
