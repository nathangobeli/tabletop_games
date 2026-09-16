import React, { useEffect } from 'react';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playVictoryFanfare, playTapSound } from '../utils/feedback';
import { VictoryConfettiOverlay } from './VictoryConfettiOverlay';

interface StatItem {
  label: string;
  p1Value: string | number;
  p2Value: string | number;
}

interface GameOverModalProps {
  winner: PlayerNumber | 'draw';
  gameName: string;
  stats?: StatItem[];
  onRestart: () => void;
  onMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  winner,
  gameName,
  stats,
  onRestart,
  onMenu,
}) => {
  useEffect(() => {
    triggerHaptic('success');
    playVictoryFanfare();
  }, []);

  const isP1 = winner === 1;
  const isP2 = winner === 2;
  const isDraw = winner === 'draw';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <VictoryConfettiOverlay />
      {/* Central Trophy Card */}
      <div
        className={`w-full max-w-xs flex flex-col items-center p-6 rounded-3xl bg-container-dark border-2 shadow-2xl text-center transition-all ${
          isP1
            ? 'border-player-1 shadow-player-1/30'
            : isP2
            ? 'border-player-2 shadow-player-2/30'
            : 'border-amber-400 shadow-amber-400/20'
        }`}
      >
        {/* Trophy / Ribbon Icon */}
        <div
          className={`w-18 h-18 mb-3 rounded-3xl p-3 flex items-center justify-center border shadow-inner ${
            isP1
              ? 'bg-player-1/20 border-player-1 text-player-1'
              : isP2
              ? 'bg-player-2/20 border-player-2 text-player-2'
              : 'bg-amber-500/20 border-amber-400 text-amber-400'
          }`}
        >
          <svg className="w-10 h-10 drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
            <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
            <path d="M4 3h16v6a8 8 0 0 1-16 0V3z" />
            <path d="M12 17v4" />
            <path d="M8 21h8" />
          </svg>
        </div>

        {/* Subtitle */}
        <span className="text-[10px] font-black uppercase tracking-widest text-accent-light/60">
          {gameName} • Match Concluded
        </span>

        {/* Big Banner Winner Text */}
        <h2
          className={`text-2xl font-black mt-1 ${
            isP1 ? 'text-blue-400' : isP2 ? 'text-red-400' : 'text-amber-400'
          }`}
        >
          {isDraw ? "It's a Draw!" : `Player ${winner} Wins!`}
        </h2>

        {/* Final Stats Summary Card */}
        {stats && stats.length > 0 && (
          <div className="w-full my-4 p-3 rounded-2xl bg-[#1e2226] border border-[#393f47] flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-accent-light/60 pb-1 border-b border-white/5">
              <span>Metric</span>
              <div className="flex gap-4">
                <span className="text-player-1">P1</span>
                <span className="text-player-2">P2</span>
              </div>
            </div>
            {stats.map((stat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-bold text-accent-light">
                <span className="text-accent-light/80 text-[11px]">{stat.label}</span>
                <div className="flex gap-4 tabular-nums">
                  <span className="text-player-1 font-black">{stat.p1Value}</span>
                  <span className="text-player-2 font-black">{stat.p2Value}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col w-full gap-2.5 mt-2">
          <button
            onClick={() => {
              triggerHaptic('medium');
              playTapSound();
              onRestart();
            }}
            type="button"
            className={`w-full py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${
              isP1
                ? 'bg-player-1 hover:bg-blue-600 shadow-blue-500/30'
                : isP2
                ? 'bg-player-2 hover:bg-red-600 shadow-red-500/30'
                : 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/30'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Play Again</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              playTapSound();
              onMenu();
            }}
            type="button"
            className="w-full py-2.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 font-black text-xs uppercase tracking-wider text-accent-light/90 border border-white/10 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
