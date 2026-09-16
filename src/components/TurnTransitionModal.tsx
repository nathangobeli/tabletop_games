import React from 'react';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playTapSound } from '../utils/feedback';

interface TurnTransitionModalProps {
  incomingPlayer: PlayerNumber;
  gameName: string;
  onReady: () => void;
}

export const TurnTransitionModal: React.FC<TurnTransitionModalProps> = ({
  incomingPlayer,
  gameName,
  onReady,
}) => {
  const isP1 = incomingPlayer === 1;

  const handleDismiss = () => {
    triggerHaptic('medium');
    playTapSound();
    onReady();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      {/* Central Modal Card */}
      <div
        className={`w-full max-w-xs flex flex-col items-center p-6 rounded-3xl bg-container-dark border-2 shadow-2xl text-center transition-all ${
          isP1 ? 'border-player-1 shadow-player-1/20' : 'border-player-2 shadow-player-2/20'
        }`}
      >
        {/* Pass Device Icon */}
        <div
          className={`w-20 h-20 mb-4 rounded-3xl flex items-center justify-center border shadow-inner ${
            isP1
              ? 'bg-player-1/20 border-player-1 text-player-1'
              : 'bg-player-2/20 border-player-2 text-player-2'
          }`}
        >
          <svg className="w-10 h-10 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
            <path d="M12 6v6" />
            <path d="M9 9l3 3 3-3" />
          </svg>
        </div>

        {/* Header Badges */}
        <span className="text-[10px] font-black uppercase tracking-widest text-accent-light/60">
          {gameName} • Pass &amp; Play
        </span>

        <h2 className="text-xl font-black mt-1 text-accent-light">
          Pass Phone to{' '}
          <span className={isP1 ? 'text-blue-400' : 'text-red-400'}>
            Player {incomingPlayer}
          </span>
        </h2>

        <p className="text-xs font-semibold text-accent-light/70 mt-2 px-2 leading-relaxed">
          It is now Player {incomingPlayer}&apos;s turn. Take the device and tap below when ready.
        </p>

        {/* Large Thumb-Friendly Action Button */}
        <button
          onClick={handleDismiss}
          type="button"
          className={`mt-6 w-full py-3.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${
            isP1
              ? 'bg-player-1 hover:bg-blue-600 shadow-blue-500/30'
              : 'bg-player-2 hover:bg-red-600 shadow-red-500/30'
          }`}
        >
          <span>Ready to Play</span>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
};
