import React, { useEffect } from 'react';
import type { GameId } from '../types/game';
import { GAME_RULES } from '../types/rules';
import { triggerHaptic, playTapSound } from '../utils/feedback';

interface GameRulesModalProps {
  gameId: GameId;
  onClose: () => void;
}

export const GameRulesModal: React.FC<GameRulesModalProps> = ({ gameId, onClose }) => {
  const rule = GAME_RULES[gameId];

  useEffect(() => {
    triggerHaptic('light');
    playTapSound();
  }, []);

  const handleClose = () => {
    triggerHaptic('light');
    playTapSound();
    onClose();
  };

  if (!rule) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      {/* Modal Container */}
      <div className="w-full max-w-md max-h-[88vh] flex flex-col rounded-3xl bg-container-dark border border-[#3e444c] shadow-2xl overflow-hidden clubhouse-board-depth">
        {/* Header Bar */}
        <div className="px-4 py-3 border-b border-[#3e444c]/80 bg-gradient-to-r from-container-dark via-[#353b42] to-container-dark flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-black text-accent-light uppercase tracking-wide leading-tight">
                {rule.title} Rules
              </h3>
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">
                {rule.category}
              </span>
            </div>
          </div>

          <button
            onClick={handleClose}
            type="button"
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-accent-light flex items-center justify-center transition-all"
            aria-label="Close Rules"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Rules Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs text-accent-light/90 scrollbar-none">
          {/* Objective Box */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block mb-1">
              🎯 Objective
            </span>
            <p className="text-xs font-semibold leading-relaxed text-accent-light">
              {rule.objective}
            </p>
          </div>

          {/* Setup Box */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block mb-1">
              🛠️ Setup
            </span>
            <p className="text-[11px] font-medium leading-relaxed text-accent-light/80">
              {rule.setup}
            </p>
          </div>

          {/* How to Play Steps */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block mb-2">
              🎲 How To Play
            </span>
            <ul className="space-y-1.5">
              {rule.howToPlay.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-[11px] font-medium leading-snug text-accent-light/90">
                    {step}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Winning Condition */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 block mb-1">
              🏆 Winning
            </span>
            <p className="text-[11px] font-semibold leading-relaxed text-accent-light">
              {rule.winningCondition}
            </p>
          </div>

          {/* Pro Tip */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1 mb-1">
              <span>💡</span> Pro Tip
            </span>
            <p className="text-[11px] font-medium italic leading-relaxed text-amber-100">
              &quot;{rule.proTip}&quot;
            </p>
          </div>
        </div>

        {/* Footer with Got It Button */}
        <div className="p-3 border-t border-[#3e444c]/80 bg-container-dark/95 flex items-center justify-center">
          <button
            onClick={handleClose}
            type="button"
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-98 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
          >
            <span>Got It, Let&apos;s Play</span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
