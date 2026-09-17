import React, { useState, useEffect } from 'react';
import type { GameId } from '../types/game';
import { GAME_RULES, type GameRule } from '../types/rules';
import { triggerHaptic, playTapSound } from '../utils/feedback';

interface RulesModalProps {
  gameId: GameId;
  onClose: () => void;
}

type TabKey = 'all' | 'objective' | 'how-to-play' | 'pro-tips';

export const RulesModal: React.FC<RulesModalProps> = ({ gameId, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const rule: GameRule | undefined = GAME_RULES[gameId];

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

  // Compile pro tips list
  const tips: string[] = rule.proTips && rule.proTips.length > 0 
    ? rule.proTips 
    : rule.proTip 
    ? [rule.proTip] 
    : ['Master board control and anticipate your opponent’s counter-strategy.'];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Frosted Dark Translucent Modal Container */}
      <div className="w-full max-w-lg max-h-[82vh] flex flex-col rounded-3xl bg-slate-900/90 backdrop-blur-md border border-slate-700/50 text-slate-100 shadow-2xl overflow-hidden transition-all duration-200">
        
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-slate-700/50 bg-slate-950/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 font-black shadow-inner">
              <span className="text-base">📜</span>
            </div>
            <div>
              <h2 id="rules-modal-title" className="text-sm sm:text-base font-black tracking-wide uppercase text-white leading-tight">
                {rule.title}
              </h2>
              <span className="text-[10px] sm:text-[11px] font-bold text-amber-400/90 uppercase tracking-widest block">
                {rule.category}
              </span>
            </div>
          </div>

          <button
            onClick={handleClose}
            type="button"
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white flex items-center justify-center transition-all border border-slate-700/60"
            aria-label="Close Rules"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scannable Tab Filter Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-950/20 border-b border-slate-800/60 shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('all');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('objective');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1 ${
              activeTab === 'objective'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>🎯</span> Objective
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('how-to-play');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1 ${
              activeTab === 'how-to-play'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>🎲</span> How to Play
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('pro-tips');
            }}
            className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1 ${
              activeTab === 'pro-tips'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>💡</span> Pro Tips
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-200 scrollbar-none">
          {/* 1. Objective Card */}
          {(activeTab === 'all' || activeTab === 'objective') && (
            <section className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">
                  🎯
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Objective
                </h3>
              </div>
              <p className="text-xs sm:text-sm font-semibold leading-relaxed text-slate-100">
                {rule.objective}
              </p>
              {rule.winningCondition && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-700/40 flex items-baseline gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 shrink-0">
                    Victory:
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-300 font-medium">
                    {rule.winningCondition}
                  </span>
                </div>
              )}
            </section>
          )}

          {/* 2. How to Play Card */}
          {(activeTab === 'all' || activeTab === 'how-to-play') && (
            <section className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
                  🎲
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  How To Play & Turn Phases
                </h3>
              </div>
              
              {rule.setup && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/40 text-[11px] text-slate-300 leading-relaxed">
                  <span className="font-black text-slate-200 mr-1.5 uppercase text-[10px]">Setup:</span>
                  {rule.setup}
                </div>
              )}

              <ul className="space-y-2.5">
                {rule.howToPlay.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-medium leading-relaxed text-slate-200">
                      {step}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 3. Pro Tips Card */}
          {(activeTab === 'all' || activeTab === 'pro-tips') && (
            <section className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs">
                  💡
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-200">
                  Tactical Pro Tips
                </h3>
              </div>
              <div className="space-y-2">
                {tips.map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs font-medium leading-relaxed text-amber-100/90">
                    <span className="text-amber-400 text-sm leading-none mt-0.5">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer Pill Close Button */}
        <div className="p-3.5 border-t border-slate-700/50 bg-slate-950/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all"
          >
            Got It, Let's Play
          </button>
        </div>
      </div>
    </div>
  );
};

export default RulesModal;
