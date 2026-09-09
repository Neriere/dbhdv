import React, { useState, useEffect } from 'react';
import { BaseRuneDefinition } from '../data/dofusRuneWeights';

interface RuneIconProps {
  rune: BaseRuneDefinition;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTooltip?: boolean;
}

const SIZE_MAP = {
  xs: {
    container: 'w-5 h-5',
    img: 'w-4 h-4',
    symbolText: 'text-[8px] font-black',
  },
  sm: {
    container: 'w-7 h-7',
    img: 'w-5 h-5',
    symbolText: 'text-[9px] font-black',
  },
  md: {
    container: 'w-8 h-8',
    img: 'w-6 h-6',
    symbolText: 'text-[10px] font-black',
  },
  lg: {
    container: 'w-10 h-10',
    img: 'w-8 h-8',
    symbolText: 'text-xs font-black',
  },
  xl: {
    container: 'w-12 h-12',
    img: 'w-10 h-10',
    symbolText: 'text-sm font-black',
  },
};

export const RuneIcon: React.FC<RuneIconProps> = ({
  rune,
  size = 'md',
  className = '',
  showTooltip = false,
}) => {
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const [srcIndex, setSrcIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  // Clean DofusDB image sources
  const fallbackUrls = [
    `https://api.dofusdb.fr/img/items/${rune.iconId}.png`,
    `https://api.dofusdb.fr/img/items/${rune.id}.png`,
    `https://dofusdb.fr/icons/${rune.iconId}.png`,
    `https://dofusdb.fr/icons/${rune.id}.png`,
  ];

  useEffect(() => {
    setSrcIndex(0);
    setAllFailed(false);
  }, [rune.id, rune.iconId]);

  const handleImgError = () => {
    if (srcIndex < fallbackUrls.length - 1) {
      setSrcIndex((prev) => prev + 1);
    } else {
      setAllFailed(true);
    }
  };

  const runeColor = rune.color || '#f59e0b';
  const runeSymbol = rune.symbol || rune.shortCode || 'R';

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-xl select-none shrink-0 overflow-hidden font-bold transition-all shadow-sm ${sizeConfig.container} ${className}`}
      style={{
        backgroundColor: `${runeColor}15`,
        border: `1.5px solid ${runeColor}40`,
        boxShadow: `0 0 8px ${runeColor}15`,
      }}
      title={showTooltip ? `${rune.name} - ${rune.description} (Peso: ${rune.unitWeight})` : undefined}
    >
      {!allFailed ? (
        <img
          src={fallbackUrls[srcIndex]}
          alt={rune.name}
          className={`${sizeConfig.img} object-contain transition-opacity duration-150`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleImgError}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-black"
          style={{
            background: `radial-gradient(circle, ${runeColor}25 0%, #090d16 100%)`,
          }}
        >
          <span
            className={`leading-none tracking-tighter ${sizeConfig.symbolText}`}
            style={{ color: runeColor }}
          >
            {runeSymbol}
          </span>
        </div>
      )}
    </div>
  );
};
