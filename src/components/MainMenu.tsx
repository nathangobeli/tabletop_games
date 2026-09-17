import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { GameIcon } from './GameIcon';
import { GameRulesModal } from './GameRulesModal';
import type { GameMetadata, GameId } from '../types/game';
import { playTapSound, triggerHaptic } from '../utils/feedback';

export const GAME_CATALOG: GameMetadata[] = [
  {
    id: 'mancala',
    name: 'Mancala',
    category: 'Ancient Strategy',
    description: 'Sow and capture glass stones around the carved board pits.',
    accentColor: '#b45309',
  },
  {
    id: 'dots-and-boxes',
    name: 'Dots and Boxes',
    category: 'Pencil & Paper',
    description: 'Draw lines between grid points to close boxes and claim territory.',
    accentColor: '#3b82f6',
  },
  {
    id: 'speed',
    name: 'Speed',
    category: 'Rapid Card Game',
    description: 'Fast-paced matching card race with ascending & descending sequences.',
    accentColor: '#ef4444',
  },
  {
    id: 'yacht-dice',
    name: 'Yacht Dice',
    category: 'Dice & Scoring',
    description: 'Roll 5 dice up to three times to fill highest value scoring combinations.',
    accentColor: '#d97706',
  },
  {
    id: 'renegade',
    name: 'Renegade',
    category: 'Classic Reversi',
    description: 'Trap and flip opponent discs to conquer the green felt arena.',
    accentColor: '#15803d',
  },
  {
    id: 'connect-four',
    name: 'Connect Four',
    category: 'Vertical Grid',
    description: 'Drop colored discs into columns to form a straight line of four.',
    accentColor: '#eab308',
  },
  {
    id: 'air-hockey',
    name: 'Air Hockey',
    category: 'Tabletop Action',
    description: 'Fast-paced table hockey with multi-touch mallets and realistic puck physics.',
    accentColor: '#0ea5e9',
  },
  {
    id: 'toy-tennis',
    name: 'Toy Tennis',
    category: 'Retro Arcade',
    description: 'Top-down arcade tennis with ball gravity, shadow altitude, and spin shots.',
    accentColor: '#22c55e',
  },
  {
    id: 'carrom',
    name: 'Carrom',
    category: 'Strike & Pocket',
    description: 'Traditional tabletop board with realistic striker impulse, carrom men, and Queen.',
    accentColor: '#d97706',
  },
  {
    id: 'gomoku',
    name: 'Gomoku',
    category: 'Five in a Row',
    description: 'Ancient 15x15 board strategy: place black and white stones to form an unbroken line of five.',
    accentColor: '#ca8a04',
  },
  {
    id: 'checkers',
    name: 'Checkers',
    category: 'Draughts Strategy',
    description: '8x8 diagonal battle with mandatory multi-jump captures and King promotions.',
    accentColor: '#dc2626',
  },
  {
    id: 'backgammon',
    name: 'Backgammon',
    category: 'Points & Tables',
    description: 'Centuries-old classic of checkers movement, bar hits, bearing off, and dice doubling.',
    accentColor: '#854d0e',
  },
  {
    id: 'billiards',
    name: 'Billiards',
    category: 'Cue Sports',
    description: 'Classic 8-Ball pool on green baize with rotary aiming, ghost trajectory, and ball-in-hand.',
    accentColor: '#16a34a',
  },
  {
    id: 'darts',
    name: 'Darts',
    category: 'Pub Precision',
    description: 'Swipe-to-throw pub darts featuring 501 Countdown and Cricket on authentic sisal.',
    accentColor: '#ef4444',
  },
  {
    id: 'bowling',
    name: 'Bowling',
    category: 'Alley Sports',
    description: '10-frame bowling with hook spins, realistic pin scatter physics, and retro LED scoring.',
    accentColor: '#2563eb',
  },
  {
    id: 'mini-shogi',
    name: 'Mini Shogi',
    category: 'Japanese Chess',
    description: 'Tactical 5x5 board battle featuring pentagonal koma tiles, piece drops, and promotions.',
    accentColor: '#d97706',
  },
  {
    id: 'toy-curling',
    name: 'Toy Curling',
    category: 'Ice & Precision',
    description: 'Slide granite curling stones, sweep pebble ice, and target the concentric house button.',
    accentColor: '#0284c7',
  },
  {
    id: 'hex',
    name: 'Hex',
    category: 'Connection Strategy',
    description: 'Connect opposite borders across an 11x11 diamond board with vibrant translucent acrylic gems.',
    accentColor: '#2563eb',
  },
  {
    id: 'matching',
    name: 'Matching',
    category: 'Memory & Focus',
    description: 'Flip linen-embossed cards on green baize to discover matching pairs of tabletop game artifacts.',
    accentColor: '#059669',
  },
  {
    id: 'nine-mens-morris',
    name: "Nine Men's Morris",
    category: 'Ancient Strategy',
    objective: '',
    description: 'Form mills of three turned-wood pieces to capture opponent pieces across three concentric squares.',
    accentColor: '#b45309',
  },
  {
    id: 'hare-and-hounds',
    name: 'Hare and Hounds',
    category: 'Asymmetric Pursuit',
    description: 'Command three relentless bronze hounds or the elusive copper hare on a carved stone track.',
    accentColor: '#ea580c',
  },
  {
    id: 'hit-and-blow',
    name: 'Hit and Blow',
    category: 'Code Deduction',
    description: 'Deduce the secret 4-color code combination using hit and blow peg clues on a wooden console.',
    accentColor: '#9333ea',
  },
  {
    id: 'hanafuda',
    name: 'Hanafuda',
    category: 'Traditional Japanese',
    description: 'Authentic 2-player Koi-Koi flower card matching with Brights, Ribbons, Animals, and push-your-luck calls.',
    accentColor: '#dc2626',
  },
  {
    id: 'president',
    name: 'President',
    category: 'Card Climbing Duel',
    description: 'Fast-paced Daifugo duel with 8-End sweeps, 4-of-a-kind Revolutions, and wild Jokers.',
    accentColor: '#b45309',
  },
  {
    id: 'last-card',
    name: 'Last Card',
    category: 'Action Card Shedding',
    description: 'Classic Crazy Eights duel with stacking Draw 2s, Aces, Wild 8s, and intense Last Card callouts.',
    accentColor: '#e11d48',
  },
  {
    id: 'riichi-mahjong',
    name: 'Riichi Mahjong',
    category: 'Tile Strategy Duel',
    description: 'Dedicated 2-player Sanma format with Pinzu, Souzu, Honors, Pon/Kan/Ron calls, and Riichi tenpai bets.',
    accentColor: '#047857',
  },
];

export const MainMenu: React.FC = () => {
  const { startGame, settings, toggleHaptics } = useGame();

  const [selectedRulesGame, setSelectedRulesGame] = useState<GameId | null>(null);

  return (
    <div className="flex flex-col h-full w-full justify-between">
      {/* Top Header Bar */}
      <header
        style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}
        className="px-6 pb-3 flex items-center justify-between border-b border-[#2a2e33]/15 bg-[#f3e9dc] shadow-sm z-50"
      >
        <div>
          <h1 className="text-xl font-black text-container-dark tracking-tight uppercase flex items-center gap-2">
            <span>Tabletop Games</span>
          </h1>
          <p className="text-xs font-semibold text-[#7d6753]">
            22 Classic 2-Player Games • Local Pass &amp; Play
          </p>
        </div>

        {/* Haptic & Sound Toggle */}
        <button
          onClick={toggleHaptics}
          type="button"
          aria-label={settings.haptics ? 'Haptics Enabled' : 'Haptics Disabled'}
          className="w-10 h-10 rounded-2xl bg-container-dark/10 hover:bg-container-dark/15 active:scale-95 transition-all flex items-center justify-center text-container-dark shadow-inner"
        >
          {settings.haptics ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 8v8" />
              <path d="M6 5v14" />
              <path d="M10 2v20" />
              <path d="M14 2v20" />
              <path d="M18 5v14" />
              <path d="M22 8v8" />
            </svg>
          ) : (
            <svg className="w-5 h-5 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="2" y1="2" x2="22" y2="22" />
              <path d="M6 5v5" />
              <path d="M6 15v4" />
              <path d="M10 5v15" />
              <path d="M14 2v10" />
              <path d="M14 17v5" />
              <path d="M18 7v11" />
            </svg>
          )}
        </button>
      </header>

      {/* Main Responsive Game Selection Grid: 2 cols on mobile, 3 on tablet/iPad, 4 on desktop/PC */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-3 scrollbar-none flex flex-col items-center">
        <div className="w-full max-w-5xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 pb-6">
          {GAME_CATALOG.map((game) => (
            <div
              key={game.id}
              className="group relative flex flex-col items-center text-center p-3.5 bg-accent-light/95 hover:bg-accent-light rounded-3xl clubhouse-board-depth border border-[#cbb396]/50 transition-all duration-150"
            >
              {/* Rules quick info button top right */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('light');
                  playTapSound();
                  setSelectedRulesGame(game.id);
                }}
                className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 border border-amber-500/40 flex items-center justify-center text-[11px] font-black shadow-sm z-10 transition-transform active:scale-90"
                title={`${game.name} Rules`}
                aria-label={`View ${game.name} rules`}
              >
                ?
              </button>

              {/* Clickable Card Body to Start Game */}
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  startGame(game.id);
                }}
                className="w-full flex flex-col items-center focus:outline-none active:scale-95 transition-transform"
              >
                {/* Subtle top indicator pill */}
                <div className="w-8 h-1 rounded-full bg-[#d8c3a5]/70 mb-2 group-hover:bg-player-1/40 transition-colors" />

                {/* Procedural Game Icon Container */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 my-1 flex items-center justify-center p-1 rounded-2xl bg-[#f8f5f0] shadow-inner border border-[#e5dcd0]">
                  <GameIcon id={game.id} className="w-full h-full drop-shadow-sm group-hover:scale-105 transition-transform duration-200" />
                </div>

                {/* Game Title & Category Badge */}
                <div className="mt-2 w-full">
                  <h2 className="text-sm sm:text-base font-bold text-container-dark tracking-tight leading-tight">
                    {game.name}
                  </h2>
                  <span className="inline-block mt-0.5 text-[10px] font-semibold text-[#8c745e] uppercase tracking-wider">
                    {game.category}
                  </span>
                </div>

                {/* Action / Tag Row */}
                <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e8ded2]/70 border border-[#d8cbbd]/60 text-[10px] font-semibold text-[#5c4938]">
                  <span className="w-1.5 h-1.5 rounded-full bg-player-1 inline-block" />
                  <span>Play</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-player-2 inline-block" />
                </div>
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* Rules Modal in Main Menu */}
      {selectedRulesGame && (
        <GameRulesModal
          gameId={selectedRulesGame}
          onClose={() => setSelectedRulesGame(null)}
        />
      )}

      {/* Footer Info / Pass & Play Guidance */}
      <footer className="pb-safe px-4 pt-2 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-[11px] font-medium text-[#7d6753]">
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-container-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          <span>Share 1 Device • Turn by Turn</span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-widest bg-container-dark text-accent-light px-2 py-0.5 rounded-md">
          v1.0
        </span>
      </footer>
    </div>
  );
};
