import React from 'react';
import { useGame } from '../context/GameContext';
import { GameIcon } from './GameIcon';
import { GAME_CATALOG } from './MainMenu';

export const GamePlaceholder: React.FC = () => {
  const { activeGame, currentPlayer, togglePlayerTurn, resetToMenu } = useGame();

  const gameMeta = GAME_CATALOG.find((g) => g.id === activeGame);
  if (!activeGame || !gameMeta) return null;

  return (
    <div className="flex flex-col h-full w-full justify-between">
      {/* Top Game Navigation Header */}
      <header className="pt-safe px-4 pb-3 flex items-center justify-between border-b border-[#2a2e33]/10 bg-gradient-to-b from-[#f3e9dc]/80 to-transparent backdrop-blur-sm z-10">
        <button
          onClick={resetToMenu}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-container-dark text-accent-light font-bold text-xs shadow-sm active:scale-95 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Menu
        </button>

        <div className="text-center">
          <h2 className="text-base font-black text-container-dark uppercase tracking-wide">
            {gameMeta.name}
          </h2>
          <span className="text-[10px] font-semibold text-[#846b54] tracking-wider uppercase">
            {gameMeta.category}
          </span>
        </div>

        {/* Current Turn Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-2xl bg-accent-light shadow-sm border border-[#e2d8cc]">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              currentPlayer === 1 ? 'bg-player-1 ring-2 ring-player-1/30' : 'bg-player-2 ring-2 ring-player-2/30'
            }`}
          />
          <span className="text-[11px] font-black text-container-dark">
            P{currentPlayer}
          </span>
        </div>
      </header>

      {/* Main Game Stage Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-xs flex flex-col items-center p-6 rounded-3xl bg-accent-light/90 backdrop-blur-md shadow-inner border border-[#d8c3a5]/50">
          <div className="w-24 h-24 mb-4 p-2 rounded-2xl bg-[#f8f5f0] shadow-inner border border-[#e5dcd0]">
            <GameIcon id={activeGame} className="w-full h-full drop-shadow-sm" />
          </div>

          <h3 className="text-lg font-black text-container-dark tracking-tight">
            {gameMeta.name} Board
          </h3>
          <p className="text-xs font-medium text-[#6e5845] mt-1.5 leading-relaxed">
            {gameMeta.description}
          </p>

          {/* Turn Control Simulator */}
          <div className="mt-6 w-full pt-4 border-t border-[#d8c3a5]/40 flex flex-col gap-2.5">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-container-dark">
              <span>Active Turn:</span>
              <span className={`px-2 py-0.5 rounded-md text-white ${currentPlayer === 1 ? 'bg-player-1' : 'bg-player-2'}`}>
                Player {currentPlayer}
              </span>
            </div>

            <button
              onClick={togglePlayerTurn}
              type="button"
              className="w-full py-2.5 px-4 rounded-2xl bg-container-dark hover:bg-[#393e44] active:scale-95 text-accent-light font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Pass Turn to Player {currentPlayer === 1 ? 2 : 1}
            </button>
          </div>
        </div>
      </main>

      {/* Footer Safe Area */}
      <footer className="pb-safe px-4 py-2 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm text-center">
        <span className="text-[11px] font-semibold text-[#846b54]">
          Pass &amp; Play Session in Progress
        </span>
      </footer>
    </div>
  );
};
