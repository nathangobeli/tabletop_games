import React from 'react';
import { CardSuit, SUIT_SYMBOLS, isRedSuit } from '../utils/cards';

export interface ProceduralCardProps {
  card: {
    suit: CardSuit | string;
    rankLabel?: string;
    label?: string;
    isRed?: boolean;
    isJoker?: boolean;
  };
  isSelected?: boolean;
  isPlayable?: boolean;
  badge?: string | React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export const ProceduralCard: React.FC<ProceduralCardProps> = ({
  card,
  isSelected = false,
  isPlayable = false,
  badge,
  size = 'md',
  onClick,
  className = '',
  disabled = false,
}) => {
  const displayLabel = card.rankLabel || card.label || '';
  const isRed = card.isRed ?? isRedSuit(card.suit);
  const symbol = SUIT_SYMBOLS[card.suit as CardSuit] || card.suit;

  const sizeClasses = {
    sm: 'w-10 sm:w-12 h-14 sm:h-17 text-xs',
    md: 'w-12 sm:w-15 md:w-16 h-18 sm:h-22 md:h-24 text-sm',
    lg: 'w-14 sm:w-18 md:w-20 h-21 sm:h-27 md:h-30 text-base',
  }[size];

  const textColor = card.isJoker
    ? 'text-amber-500'
    : isRed
    ? 'text-rose-600'
    : 'text-stone-900';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`relative ${sizeClasses} rounded-xl bg-white border select-none transition-all duration-150 transform flex flex-col justify-between p-1 sm:p-1.5 shadow-md ${
        onClick && !disabled ? 'cursor-pointer' : 'cursor-default'
      } ${
        isSelected
          ? 'ring-3 ring-amber-400 -translate-y-2.5 scale-106 z-30 shadow-xl border-amber-400'
          : isPlayable
          ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-md hover:-translate-y-1'
          : 'border-stone-300 hover:border-stone-400'
      } ${className}`}
    >
      {/* Top Corner Pip */}
      <div className="flex items-center justify-between leading-none z-10">
        <span className={`font-black ${textColor} font-mono-digital`}>
          {displayLabel}
        </span>
        <span className={`font-bold ${textColor} text-[11px] sm:text-xs`}>
          {symbol}
        </span>
      </div>

      {/* Center Art or Custom Badge */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {badge ? (
          <div className="z-10">{badge}</div>
        ) : card.isJoker ? (
          <div className="flex flex-col items-center">
            <span className="text-base sm:text-lg animate-pulse">🃏</span>
            <span className="text-[8px] font-black tracking-tighter text-amber-600 uppercase">JOKER</span>
          </div>
        ) : (
          <div className={`text-xl sm:text-2xl font-bold opacity-85 ${textColor}`}>
            {symbol}
          </div>
        )}
      </div>

      {/* Bottom Corner Pip (Inverted) */}
      <div className="flex items-center justify-between leading-none transform rotate-180 z-10">
        <span className={`font-black ${textColor} font-mono-digital`}>
          {displayLabel}
        </span>
        <span className={`font-bold ${textColor} text-[11px] sm:text-xs`}>
          {symbol}
        </span>
      </div>

      {/* Fine Linen Texture Overlay */}
      <div
        style={{
          backgroundImage: 'radial-gradient(rgba(0,0,0,0.03) 1px, transparent 0)',
          backgroundSize: '4px 4px',
        }}
        className="absolute inset-0 rounded-xl pointer-events-none"
      />
    </button>
  );
};
