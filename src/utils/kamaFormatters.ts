/**
 * Utility functions for formatting Kamas currency and numbers in Dofus
 */

export interface KamaFormatOptions {
  showSign?: boolean;
  compact?: boolean;
  precision?: number;
}

/**
 * Formats a number into a clean Kamas string (e.g., 51.909 K or 1.25 M)
 */
export function formatKamasNumber(
  amount: number,
  options: KamaFormatOptions = {}
): {
  formatted: string;
  full: string;
  isPositive: boolean;
  isNegative: boolean;
  sign: string;
} {
  const { showSign = false, compact = false, precision = 2 } = options;
  const isPositive = amount > 0;
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  let sign = '';
  if (showSign) {
    if (isPositive) sign = '+';
    else if (isNegative) sign = '-';
  } else if (isNegative) {
    sign = '-';
  }

  // Full string with thousand dot separators (e.g., "12.345.678 K")
  const full = `${sign}${Math.round(absAmount).toLocaleString('de-DE')} K`;

  let formatted = full;

  if (compact) {
    if (absAmount >= 1_000_000_000) {
      const bValue = (absAmount / 1_000_000_000).toFixed(precision).replace(/\.00$/, '');
      formatted = `${sign}${bValue} B`;
    } else if (absAmount >= 10_000_000) {
      const mValue = (absAmount / 1_000_000).toFixed(1).replace(/\.0$/, '');
      formatted = `${sign}${mValue} M`;
    } else if (absAmount >= 1_000_000) {
      const mValue = (absAmount / 1_000_000).toFixed(precision).replace(/\.00$/, '');
      formatted = `${sign}${mValue} M`;
    } else {
      formatted = full;
    }
  }

  return {
    formatted,
    full,
    isPositive,
    isNegative,
    sign,
  };
}

/**
 * Format standard percentage
 */
export function formatPercent(value: number, precision = 1): string {
  return `${value.toFixed(precision).replace(/\.0$/, '')}%`;
}
