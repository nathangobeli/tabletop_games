import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import type { PlayerNumber, GameId } from '../types/game';
import { triggerHaptic, playTapSound } from '../utils/feedback';
import { GameRulesModal } from './GameRulesModal';

interface GameHeaderProps {
  title?: string;
  gameName?: string;
  subtitle?: string;
  subStatusText?: string;
  turn: PlayerNumber;
  scoreP1?: number | string;
  scoreP2?: number | string;
  p1Label?: string;
  p2Label?: string;
  onRestart: () => void;
  statusMessage?: string;
  gameId?: GameId;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  title,
  gameName,
  subtitle,
  subStatusText,
  turn,
  scoreP1,
  scoreP2,
  p1Label = 'Player 1',
  p2Label = 'Player 2',
  onRestart,
  statusMessage,
  gameId,
}) => {
  const { resetToMenu, activeGame } = useGame();
  const [showRules, setShowRules] = useState<boolean>(false);

  // Target gameId defaults to passed prop or context activeGame
  const targetGameId = gameId || activeGame;
  const displayTitle = title || gameName || 'Game';
  const displaySubtitle = subtitle || subStatusText;
  const activeLabel = turn === 1 ? p1Label : p2Label;

  return (
    <>
      <header className="pt-safe px-3.5 pb-2.5 flex flex-col gap-1.5 border-b border-[#2a2e33]/15 bg-gradient-to-b from-[#f3e9dc]/90 to-[#e9dac7]/80 backdrop-blur-md shadow-sm z-20">
        {/* Top action row */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              triggerHaptic('light');
              playTapSound();
              resetToMenu();
            }}
            type="button"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-container-dark hover:bg-[#393e44] active:scale-95 text-accent-light font-bold text-xs shadow-sm transition-all"
            aria-label="Back to Main Menu"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Menu</span>
          </button>

          <div className="text-center">
            <h2 className="text-sm font-black text-container-dark tracking-wide uppercase leading-tight">
              {displayTitle}
            </h2>
            {displaySubtitle && (
              <span className="text-[10px] font-semibold text-[#846b54] tracking-wider uppercase block">
                {displaySubtitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {targetGameId && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  playTapSound();
                  setShowRules(true);
                }}
                type="button"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-900 font-black text-xs shadow-sm border border-amber-500/40 transition-all"
                aria-label="How to Play / Rules"
                title="How to Play"
              >
                <svg className="w-3.5 h-3.5 text-amber-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <span>Rules</span>
              </button>
            )}

            <button
              onClick={() => {
                triggerHaptic('medium');
                playTapSound();
                onRestart();
              }}
              type="button"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-accent-light hover:bg-white active:scale-95 text-container-dark font-bold text-xs shadow-sm border border-[#d8c3a5]/60 transition-all"
              aria-label="Restart Current Game"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Reset</span>
            </button>
          </div>
        </div>

      {/* Players status & score bar with Persistent Active Turn Pill */}
      <div className="flex items-center justify-between gap-1.5 px-0.5">
        {/* Player 1 Card */}
        <div
          className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-200 border ${
            turn === 1
              ? 'bg-player-1/15 border-player-1 shadow-sm ring-1 ring-player-1/40 scale-[1.01]'
              : 'bg-white/40 border-transparent opacity-65 scale-[0.99]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                turn === 1 ? 'bg-player-1 ring-2 ring-player-1/40 animate-pulse' : 'bg-player-1/60'
              }`}
            />
            <span className={`text-[11px] font-bold ${turn === 1 ? 'text-player-1' : 'text-container-dark/80'}`}>
              {p1Label}
            </span>
          </div>
          {scoreP1 !== undefined && (
            <span className="text-xs font-black text-container-dark tabular-nums bg-white/80 px-2 py-0.5 rounded-lg border border-black/5">
              {scoreP1}
            </span>
          )}
        </div>

        {/* Lightweight Persistent Turn Pill / Badge */}
        <div
          key={turn}
          className={`px-2.5 py-1 rounded-full border text-center transition-all duration-200 animate-turn-pulse shadow-sm flex items-center gap-1.5 shrink-0 ${
            turn === 1
              ? 'border-player-1/60 bg-blue-500/15 text-blue-800 shadow-[0_0_10px_rgba(59,130,246,0.25)] ring-1 ring-player-1/50'
              : 'border-player-2/60 bg-red-500/15 text-red-800 shadow-[0_0_10px_rgba(239,68,68,0.25)] ring-1 ring-player-2/50'
          }`}
          title={`${activeLabel}'s Turn`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              turn === 1 ? 'bg-player-1' : 'bg-player-2'
            } ring-2 ${turn === 1 ? 'ring-player-1/40' : 'ring-player-2/40'} animate-ping`}
          />
          <span className="text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap">
            {activeLabel}'s Turn
          </span>
        </div>

        {/* Player 2 Card */}
        <div
          className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-200 border ${
            turn === 2
              ? 'bg-player-2/15 border-player-2 shadow-sm ring-1 ring-player-2/40 scale-[1.01]'
              : 'bg-white/40 border-transparent opacity-65 scale-[0.99]'
          }`}
        >
          {scoreP2 !== undefined && (
            <span className="text-xs font-black text-container-dark tabular-nums bg-white/80 px-2 py-0.5 rounded-lg border border-black/5">
              {scoreP2}
            </span>
          )}
          <div className="flex items-center gap-1.5 justify-end">
            <span className={`text-[11px] font-bold ${turn === 2 ? 'text-player-2' : 'text-container-dark/80'}`}>
              {p2Label}
            </span>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                turn === 2 ? 'bg-player-2 ring-2 ring-player-2/40 animate-pulse' : 'bg-player-2/60'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Dynamic Status / Banner Message */}
      {statusMessage && (
        <div className="bg-container-dark text-accent-light text-center py-1 px-3 rounded-lg text-[11px] font-bold tracking-wide shadow-inner animate-fade-in flex items-center justify-center gap-1.5">
          <span>{statusMessage}</span>
        </div>
      )}
    </header>

    {/* Rules & Instructions Modal */}
    {showRules && targetGameId && (
      <GameRulesModal
        gameId={targetGameId}
        onClose={() => setShowRules(false)}
      />
    )}
  </>
);
};
