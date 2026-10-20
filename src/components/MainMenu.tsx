import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { GameIcon } from './GameIcon';
import { GameRulesModal } from './GameRulesModal';
import { RemoteDuelModal } from './RemoteDuelModal';
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
  {
    id: 'battleship',
    name: 'Battleship',
    category: 'Naval Tactical Combat',
    description: 'Secret 2-screen naval duel: deploy your 5 warships, hunt across enemy radar, and sink the opposing armada.',
    accentColor: '#0284c7',
  },
  {
    id: 'cribbage',
    name: 'Cribbage',
    category: '121-Point Classic',
    description: 'Continuous 120-hole carved wooden board with brass & steel leapfrog pegs, discard synergy, and pegging to 31.',
    accentColor: '#b45309',
  },
];

import type { TableTheme } from '../types/game';

type CategoryFilter = 'all' | 'favorites' | 'cards' | 'strategy' | 'action' | 'dice';

const CATEGORY_GROUPS: Record<Exclude<CategoryFilter, 'all' | 'favorites'>, GameId[]> = {
  cards: ['cribbage', 'speed', 'hanafuda', 'president', 'last-card', 'riichi-mahjong', 'matching'],
  strategy: [
    'mancala',
    'renegade',
    'connect-four',
    'gomoku',
    'checkers',
    'backgammon',
    'mini-shogi',
    'hex',
    'nine-mens-morris',
    'hare-and-hounds',
    'battleship',
  ],
  action: ['air-hockey', 'toy-tennis', 'carrom', 'billiards', 'darts', 'bowling', 'toy-curling'],
  dice: ['yacht-dice', 'dots-and-boxes', 'hit-and-blow'],
};

const getStoredFavorites = (): GameId[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('tabletop_favorites');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const MainMenu: React.FC = () => {
  const { startGame, settings, toggleHaptics, theme, setTheme, gameMode, setGameMode } = useGame();

  const [selectedRulesGame, setSelectedRulesGame] = useState<GameId | null>(null);
  const [showRemoteModal, setShowRemoteModal] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [favorites, setFavorites] = useState<GameId[]>(getStoredFavorites);

  const toggleFavorite = (id: GameId, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    playTapSound();
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('tabletop_favorites', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const THEMES: { id: TableTheme; label: string; icon: string }[] = [
    { id: 'wood', label: 'Wood', icon: '🪵' },
    { id: 'midnight', label: 'Night', icon: '🌌' },
    { id: 'emerald', label: 'Felt', icon: '🟢' },
    { id: 'arcade', label: 'Arcade', icon: '⚡' },
  ];

  const FILTER_PILLS: { id: CategoryFilter; label: string; icon: string; count: number }[] = [
    { id: 'all', label: 'All', icon: '🎲', count: GAME_CATALOG.length },
    { id: 'favorites', label: 'Saved', icon: '⭐', count: favorites.length },
    { id: 'cards', label: 'Cards & Tile', icon: '🃏', count: CATEGORY_GROUPS.cards.length },
    { id: 'strategy', label: 'Strategy', icon: '♟️', count: CATEGORY_GROUPS.strategy.length },
    { id: 'action', label: 'Action & Sports', icon: '🎯', count: CATEGORY_GROUPS.action.length },
    { id: 'dice', label: 'Dice & Logic', icon: '🧩', count: CATEGORY_GROUPS.dice.length },
  ];

  const cycleTheme = () => {
    triggerHaptic('light');
    playTapSound();
    const currentIndex = THEMES.findIndex((t) => t.id === theme);
    const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
    setTheme(nextTheme.id);
  };

  const toggleDefaultMode = () => {
    triggerHaptic('light');
    playTapSound();
    setGameMode(gameMode === 'pve' ? 'pvp' : 'pve');
  };

  const filteredCatalog = React.useMemo(() => {
    if (activeFilter === 'favorites') {
      return GAME_CATALOG.filter((g) => favorites.includes(g.id));
    }
    if (activeFilter !== 'all') {
      const groupIds = CATEGORY_GROUPS[activeFilter];
      return GAME_CATALOG.filter((g) => groupIds.includes(g.id));
    }
    // In 'all' view, pin favorited games to the top while preserving catalog order
    if (favorites.length === 0) return GAME_CATALOG;
    const favGames = GAME_CATALOG.filter((g) => favorites.includes(g.id));
    const otherGames = GAME_CATALOG.filter((g) => !favorites.includes(g.id));
    return [...favGames, ...otherGames];
  }, [activeFilter, favorites]);

  const isDarkTheme = theme === 'midnight' || theme === 'arcade' || theme === 'emerald';

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-transparent">
      {/* Top Header Bar */}
      <header
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 8px), 14px)',
          WebkitBackdropFilter: 'none',
          backdropFilter: 'none',
        }}
        className={`flex-shrink-0 relative px-3 sm:px-6 pb-2 flex items-center justify-between border-b shadow-sm z-50 gap-1.5 sm:gap-2 select-none transition-colors duration-300 ${
          isDarkTheme
            ? 'bg-stone-900/90 border-white/10 text-stone-100'
            : 'bg-[#f3e9dc]/95 border-[#2a2e33]/15 text-container-dark'
        }`}
      >
        <div className="min-w-0 flex-1">
          <h1
            className={`text-base sm:text-xl font-black tracking-tight uppercase flex items-center gap-1.5 truncate ${
              isDarkTheme ? 'text-amber-50' : 'text-container-dark'
            }`}
          >
            <span>Tabletop Games</span>
          </h1>
          <p
            className={`text-[10px] sm:text-xs font-semibold truncate ${
              isDarkTheme ? 'text-stone-400' : 'text-[#7d6753]'
            }`}
          >
            {GAME_CATALOG.length} Classic Games • {gameMode === 'pve' ? 'Solo vs CPU' : '2P Pass & Play'} • Remote Duel
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Default Play Mode Quick Toggle (Vs CPU vs 2P Pass) */}
          <button
            onClick={toggleDefaultMode}
            type="button"
            title={gameMode === 'pve' ? 'Default Mode: Solo vs CPU (Tap for 2P Pass & Play)' : 'Default Mode: 2P Pass & Play (Tap for Solo vs CPU)'}
            className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl sm:rounded-2xl border text-[11px] sm:text-xs font-black shadow-xs transition-all flex items-center gap-1 shrink-0 active:scale-95 ${
              gameMode === 'pve'
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-800 dark:text-sky-300 border-sky-500/40'
            } ${isDarkTheme ? (gameMode === 'pve' ? '!text-emerald-300' : '!text-sky-300') : ''}`}
          >
            <span>{gameMode === 'pve' ? '🤖' : '👥'}</span>
            <span className="text-[10px] sm:text-xs">{gameMode === 'pve' ? 'Vs CPU' : '2P Pass'}</span>
          </button>

          {/* Online Remote Duel Button */}
          <button
            onClick={() => {
              triggerHaptic('light');
              playTapSound();
              setShowRemoteModal(true);
            }}
            type="button"
            aria-label="Online Remote Duel"
            title="Online P2P Duel"
            className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl sm:rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 border border-amber-500/40 text-xs font-black shadow-xs transition-all flex items-center gap-1 shrink-0 ${
              isDarkTheme ? 'text-amber-300' : 'text-amber-900'
            }`}
          >
            <span>🌐</span>
            <span className="hidden md:inline">Online Duel</span>
          </button>

          {/* Mobile Theme Cycler Button */}
          <button
            onClick={cycleTheme}
            type="button"
            title={`Current Theme: ${THEMES.find((t) => t.id === theme)?.label}. Tap to cycle table theme.`}
            className={`sm:hidden w-8 h-8 rounded-xl active:scale-95 text-xs flex items-center justify-center border shadow-inner shrink-0 transition-all ${
              isDarkTheme
                ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
                : 'bg-container-dark/10 hover:bg-container-dark/15 border-stone-300/40'
            }`}
          >
            <span>{THEMES.find((t) => t.id === theme)?.icon}</span>
          </button>

          {/* Desktop Theme Selector Pill Group */}
          <div
            className={`hidden sm:flex items-center p-1 rounded-2xl border shadow-inner shrink-0 ${
              isDarkTheme ? 'bg-white/10 border-white/15' : 'bg-container-dark/10 border-stone-300/40'
            }`}
          >
            {THEMES.map((t) => {
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  type="button"
                  title={`${t.label} Theme`}
                  className={`px-2 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                    isActive
                      ? 'bg-amber-500 text-stone-900 shadow-sm scale-102'
                      : isDarkTheme
                      ? 'text-stone-300 hover:text-white opacity-80 hover:opacity-100'
                      : 'text-stone-600 hover:text-stone-900 opacity-80 hover:opacity-100'
                  }`}
                >
                  <span className="text-xs">{t.icon}</span>
                  <span className="hidden lg:inline text-[11px]">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Haptic & Sound Toggle */}
          <button
            onClick={toggleHaptics}
            type="button"
            title={settings.haptics ? 'Sound & Haptics ON (Tap to Mute)' : 'Sound & Haptics Muted (Tap to Enable)'}
            aria-label={settings.haptics ? 'Sound and Haptics Enabled' : 'Sound and Haptics Disabled'}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl active:scale-95 transition-all flex items-center justify-center shadow-inner shrink-0 border ${
              isDarkTheme
                ? 'bg-white/10 hover:bg-white/15 border-white/15 text-stone-100'
                : 'bg-container-dark/10 hover:bg-container-dark/15 border-stone-300/40 text-container-dark'
            }`}
          >
            {settings.haptics ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8v8" />
                <path d="M6 5v14" />
                <path d="M10 2v20" />
                <path d="M14 2v20" />
                <path d="M18 5v14" />
                <path d="M22 8v8" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
        </div>
      </header>

      {/* Mobile-First Horizontally Scrollable Category Filter Bar */}
      <nav
        aria-label="Game categories"
        className={`flex-shrink-0 w-full border-b z-40 transition-colors duration-300 ${
          isDarkTheme ? 'bg-stone-950/60 border-white/10' : 'bg-[#ede1d1]/90 border-[#cbb396]/40'
        }`}
      >
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {FILTER_PILLS.map((pill) => {
            const isSelected = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  playTapSound();
                  setActiveFilter(pill.id);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap flex items-center gap-1 transition-all shrink-0 active:scale-95 ${
                  isSelected
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : isDarkTheme
                    ? 'bg-white/10 text-stone-300 hover:bg-white/15 border border-white/10'
                    : 'bg-white/65 text-[#5c4938] hover:bg-white border border-[#cbb396]/50'
                }`}
              >
                <span>{pill.icon}</span>
                <span>{pill.label}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-black tabular-nums ${
                    isSelected
                      ? 'bg-stone-950/20 text-stone-950'
                      : isDarkTheme
                      ? 'bg-black/30 text-stone-400'
                      : 'bg-[#d8c3a5]/50 text-[#6e5641]'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Responsive Game Selection Grid: 2 cols on mobile, 3 on tablet/iPad, 4 on desktop/PC */}
      <main
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-6 md:px-8 py-3 scrollbar-none flex flex-col items-center pb-safe"
      >
        {filteredCatalog.length === 0 ? (
          <div
            className={`w-full max-w-md my-auto p-6 rounded-3xl text-center border shadow-md ${
              isDarkTheme
                ? 'bg-stone-900/85 border-white/15 text-stone-200'
                : 'bg-accent-light/95 border-[#cbb396]/60 text-container-dark'
            }`}
          >
            <div className="text-3xl mb-2">⭐</div>
            <h2 className="text-base font-black uppercase tracking-tight">No Saved Favorites Yet</h2>
            <p className="text-xs opacity-75 mt-1">
              Tap the star icon in the top-left corner of any game card to pin your favorite tabletop games here for instant access.
            </p>
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="mt-4 px-4 py-2 rounded-xl bg-amber-500 text-stone-950 text-xs font-black uppercase tracking-wide shadow-sm active:scale-95 transition-transform"
            >
              Browse All {GAME_CATALOG.length} Games
            </button>
          </div>
        ) : (
          <div className="w-full max-w-5xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4 pb-6">
            {filteredCatalog.map((game) => {
              const isFav = favorites.includes(game.id);
              return (
                <div
                  key={game.id}
                  className={`group relative flex flex-col items-center text-center p-3 sm:p-3.5 rounded-3xl clubhouse-board-depth border transition-all duration-150 ${
                    isDarkTheme
                      ? isFav
                        ? 'bg-stone-900/90 hover:bg-stone-900 border-amber-400/60 ring-1 ring-amber-400/30'
                        : 'bg-stone-900/85 hover:bg-stone-900/95 border-white/15'
                      : isFav
                      ? 'bg-accent-light hover:bg-white border-amber-500/70 ring-1 ring-amber-500/30'
                      : 'bg-accent-light/95 hover:bg-accent-light border-[#cbb396]/50'
                  }`}
                >
                  {/* Favorite pin button top left */}
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(game.id, e)}
                    className={`absolute top-2.5 left-2.5 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-xs z-10 transition-transform active:scale-90 border ${
                      isFav
                        ? 'bg-amber-400/30 text-amber-500 border-amber-400/60'
                        : isDarkTheme
                        ? 'bg-white/10 text-stone-400 hover:text-amber-300 border-white/15'
                        : 'bg-stone-200/70 text-stone-400 hover:text-amber-600 border-stone-300/60'
                    }`}
                    title={isFav ? `Unpin ${game.name}` : `Pin ${game.name} to Favorites`}
                    aria-label={isFav ? `Remove ${game.name} from favorites` : `Add ${game.name} to favorites`}
                  >
                    {isFav ? '★' : '☆'}
                  </button>

                  {/* Rules quick info button top right */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('light');
                      playTapSound();
                      setSelectedRulesGame(game.id);
                    }}
                    className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 flex items-center justify-center text-[11px] font-black shadow-sm z-10 transition-transform active:scale-90 ${
                      isDarkTheme ? 'text-amber-300' : 'text-amber-900'
                    }`}
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
                    <div
                      className={`w-8 h-1 rounded-full mb-1.5 transition-colors ${
                        isFav
                          ? 'bg-amber-400'
                          : isDarkTheme
                          ? 'bg-white/20 group-hover:bg-amber-400/60'
                          : 'bg-[#d8c3a5]/70 group-hover:bg-player-1/40'
                      }`}
                    />

                    {/* Procedural Game Icon Container */}
                    <div
                      className={`w-20 h-20 sm:w-24 sm:h-24 my-1 flex items-center justify-center p-1 rounded-2xl shadow-inner border ${
                        isDarkTheme
                          ? 'bg-stone-800/90 border-white/10'
                          : 'bg-[#f8f5f0] border-[#e5dcd0]'
                      }`}
                    >
                      <GameIcon id={game.id} className="w-full h-full drop-shadow-sm group-hover:scale-105 transition-transform duration-200" />
                    </div>

                    {/* Game Title & Category Badge */}
                    <div className="mt-1.5 w-full">
                      <h2
                        className={`text-sm sm:text-base font-bold tracking-tight leading-tight truncate ${
                          isDarkTheme ? 'text-stone-100' : 'text-container-dark'
                        }`}
                      >
                        {game.name}
                      </h2>
                      <span
                        className={`inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wider truncate max-w-full ${
                          isDarkTheme ? 'text-stone-400' : 'text-[#8c745e]'
                        }`}
                      >
                        {game.category}
                      </span>
                    </div>

                    {/* Action / Tag Row */}
                    <div
                      className={`mt-2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${
                        isDarkTheme
                          ? 'bg-white/10 border-white/15 text-stone-200'
                          : 'bg-[#e8ded2]/70 border-[#d8cbbd]/60 text-[#5c4938]'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-player-1 inline-block" />
                      <span>{gameMode === 'pve' ? 'Play vs CPU' : '2P Pass'}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-player-2 inline-block" />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Info / Pass & Play Guidance at bottom of scrollable catalog */}
        <footer
          className={`w-full max-w-5xl pb-safe pt-3 border-t flex items-center justify-between text-[11px] font-medium mt-auto ${
            isDarkTheme ? 'border-white/15 text-stone-300' : 'border-[#2a2e33]/15 text-[#7d6753]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            <span>Share 1 Device • Play vs CPU • Online Duel</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest bg-container-dark text-accent-light px-2 py-0.5 rounded-md border border-white/10">
            v2.2.0
          </span>
        </footer>
      </main>

      {/* Rules Modal in Main Menu */}
      {selectedRulesGame && (
        <GameRulesModal
          gameId={selectedRulesGame}
          onClose={() => setSelectedRulesGame(null)}
        />
      )}

      {/* Remote Duel WebRTC Modal */}
      <RemoteDuelModal
        isOpen={showRemoteModal}
        onClose={() => setShowRemoteModal(false)}
      />
    </div>
  );
};
