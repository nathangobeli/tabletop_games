import React, { useCallback, useMemo, useReducer, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playTapSound, playCaptureSound } from '../utils/feedback';

export interface Die {
  value: number; // 1-6
  held: boolean;
}

// 12 Scoring Categories
export type CategoryKey =
  | 'ones'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'choice'
  | 'fourOfAKind'
  | 'fullHouse'
  | 'smallStraight'
  | 'largeStraight'
  | 'yacht';

export interface CategoryDef {
  key: CategoryKey;
  name: string;
  section: 'upper' | 'lower';
  desc: string;
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'ones', name: 'Ones', section: 'upper', desc: 'Sum of 1s' },
  { key: 'twos', name: 'Twos', section: 'upper', desc: 'Sum of 2s' },
  { key: 'threes', name: 'Threes', section: 'upper', desc: 'Sum of 3s' },
  { key: 'fours', name: 'Fours', section: 'upper', desc: 'Sum of 4s' },
  { key: 'fives', name: 'Fives', section: 'upper', desc: 'Sum of 5s' },
  { key: 'sixes', name: 'Sixes', section: 'upper', desc: 'Sum of 6s' },
  { key: 'choice', name: 'Choice', section: 'lower', desc: 'Sum of all dice' },
  { key: 'fourOfAKind', name: '4 of a Kind', section: 'lower', desc: '4 matching -> Total sum' },
  { key: 'fullHouse', name: 'Full House', section: 'lower', desc: '3 of a kind + Pair -> 25 pts' },
  { key: 'smallStraight', name: 'S. Straight', section: 'lower', desc: '4 sequential -> 30 pts' },
  { key: 'largeStraight', name: 'L. Straight', section: 'lower', desc: '5 sequential -> 40 pts' },
  { key: 'yacht', name: 'Yacht', section: 'lower', desc: '5 matching -> 50 pts' },
];

export type Scorecard = Partial<Record<CategoryKey, number>>;

// =======================================================
// State Machine Definition & Reducer
// =======================================================

export type YachtPhase =
  | 'INITIAL_ROLL'     // Turn start: 3 rolls left, holding dice is disabled until first roll
  | 'ROLLING'          // Dice tumbling: all inputs locked
  | 'DECIDING'         // Dice settled: player can toggle holds, re-roll, or pick category
  | 'TURN_TRANSITION'  // Scorecard entry picked: brief celebration/sound before next turn
  | 'GAME_OVER';       // All 12 categories scored by both players: match finished!

export interface YachtState {
  phase: YachtPhase;
  turn: PlayerNumber;
  rollsRemaining: number;
  dice: Die[];
  scorecardP1: Scorecard;
  scorecardP2: Scorecard;
  winner: PlayerNumber | 'draw' | null;
  statusMessage: string;
}

export type YachtAction =
  | { type: 'START_ROLL' }
  | { type: 'SET_JITTER_DICE'; dice: Die[] }
  | { type: 'FINISH_ROLL'; finalDice: Die[] }
  | { type: 'TOGGLE_DIE_HOLD'; index: number }
  | { type: 'SCORE_CATEGORY'; category: CategoryKey; score: number }
  | { type: 'ADVANCE_TURN' }
  | { type: 'RESTART_GAME' };

// Score calculation engine
export const calculateScore = (key: CategoryKey, values: number[]): number => {
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const sumAll = values.reduce((a, b) => a + b, 0);

  switch (key) {
    case 'ones':
      return (counts.get(1) || 0) * 1;
    case 'twos':
      return (counts.get(2) || 0) * 2;
    case 'threes':
      return (counts.get(3) || 0) * 3;
    case 'fours':
      return (counts.get(4) || 0) * 4;
    case 'fives':
      return (counts.get(5) || 0) * 5;
    case 'sixes':
      return (counts.get(6) || 0) * 6;
    case 'choice':
      return sumAll;
    case 'fourOfAKind': {
      const hasFour = Array.from(counts.values()).some((c) => c >= 4);
      return hasFour ? sumAll : 0;
    }
    case 'fullHouse': {
      const vals = Array.from(counts.values()).sort((a, b) => b - a);
      const isFH = (vals[0] === 3 && vals[1] === 2) || vals[0] === 5;
      return isFH ? 25 : 0;
    }
    case 'smallStraight': {
      const uniqueSorted = Array.from(new Set(values)).sort((a, b) => a - b);
      const str = uniqueSorted.join('');
      const hasSmall = str.includes('1234') || str.includes('2345') || str.includes('3456');
      return hasSmall ? 30 : 0;
    }
    case 'largeStraight': {
      const sorted = [...values].sort((a, b) => a - b).join('');
      const hasLarge = sorted === '12345' || sorted === '23456';
      return hasLarge ? 40 : 0;
    }
    case 'yacht': {
      const isYacht = Array.from(counts.values()).some((c) => c === 5);
      return isYacht ? 50 : 0;
    }
    default:
      return 0;
  }
};

// Compute upper sum, bonus, and totals
export const computeTotals = (card: Scorecard) => {
  let upperSum = 0;
  const upperKeys: CategoryKey[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  upperKeys.forEach((k) => {
    if (card[k] !== undefined) upperSum += card[k]!;
  });

  const upperBonus = upperSum >= 63 ? 35 : 0;

  let lowerSum = 0;
  const lowerKeys: CategoryKey[] = [
    'choice',
    'fourOfAKind',
    'fullHouse',
    'smallStraight',
    'largeStraight',
    'yacht',
  ];
  lowerKeys.forEach((k) => {
    if (card[k] !== undefined) lowerSum += card[k]!;
  });

  const total = upperSum + upperBonus + lowerSum;
  return { upperSum, upperBonus, lowerSum, total };
};

const createInitialYachtState = (): YachtState => ({
  phase: 'INITIAL_ROLL',
  turn: 1,
  rollsRemaining: 3,
  dice: [
    { value: 1, held: false },
    { value: 2, held: false },
    { value: 3, held: false },
    { value: 4, held: false },
    { value: 5, held: false },
  ],
  scorecardP1: {},
  scorecardP2: {},
  winner: null,
  statusMessage: 'Player 1: Roll the dice to start turn (3 rolls left)',
});

const yachtReducer = (state: YachtState, action: YachtAction): YachtState => {
  switch (action.type) {
    case 'START_ROLL': {
      // Guard: can only roll in INITIAL_ROLL or DECIDING when rolls > 0 and no winner
      if (
        (state.phase !== 'INITIAL_ROLL' && state.phase !== 'DECIDING') ||
        state.rollsRemaining <= 0 ||
        state.winner !== null
      ) {
        return state;
      }
      return {
        ...state,
        phase: 'ROLLING',
        statusMessage: `Rolling dice... (${state.rollsRemaining - 1} rolls left after this)`,
      };
    }

    case 'SET_JITTER_DICE': {
      if (state.phase !== 'ROLLING') return state;
      return {
        ...state,
        dice: action.dice,
      };
    }

    case 'FINISH_ROLL': {
      if (state.phase !== 'ROLLING') return state;
      const nextRolls = state.rollsRemaining - 1;
      const status =
        nextRolls === 0
          ? `No rolls left! Player ${state.turn}: Tap a category to score.`
          : `Player ${state.turn}: Hold dice or roll again (${nextRolls} left).`;

      return {
        ...state,
        phase: 'DECIDING',
        rollsRemaining: nextRolls,
        dice: action.finalDice,
        statusMessage: status,
      };
    }

    case 'TOGGLE_DIE_HOLD': {
      // Guard: can ONLY hold dice in DECIDING phase (not before first roll or during roll)
      if (state.phase !== 'DECIDING' || state.winner !== null) return state;

      const nextDice = state.dice.map((d, i) =>
        i === action.index ? { ...d, held: !d.held } : d
      );
      return {
        ...state,
        dice: nextDice,
      };
    }

    case 'SCORE_CATEGORY': {
      // Guard: can ONLY score in DECIDING phase
      if (state.phase !== 'DECIDING' || state.winner !== null) return state;

      const currentCard = state.turn === 1 ? state.scorecardP1 : state.scorecardP2;
      if (currentCard[action.category] !== undefined) return state;

      const nextCard = { ...currentCard, [action.category]: action.score };
      const newP1Card = state.turn === 1 ? nextCard : state.scorecardP1;
      const newP2Card = state.turn === 2 ? nextCard : state.scorecardP2;

      // Check Game Over (both players filled all 12 categories)
      const p1Count = Object.keys(newP1Card).length;
      const p2Count = Object.keys(newP2Card).length;

      if (p1Count === 12 && p2Count === 12) {
        const finalP1 = computeTotals(newP1Card).total;
        const finalP2 = computeTotals(newP2Card).total;

        let winResult: PlayerNumber | 'draw' = 'draw';
        let endMsg = `Game Over! Tie (${finalP1} - ${finalP2})`;
        if (finalP1 > finalP2) {
          winResult = 1;
          endMsg = `🎉 Player 1 Wins with ${finalP1} points!`;
        } else if (finalP2 > finalP1) {
          winResult = 2;
          endMsg = `🎉 Player 2 Wins with ${finalP2} points!`;
        }

        return {
          ...state,
          phase: 'GAME_OVER',
          scorecardP1: newP1Card,
          scorecardP2: newP2Card,
          winner: winResult,
          statusMessage: endMsg,
        };
      }

      return {
        ...state,
        phase: 'TURN_TRANSITION',
        scorecardP1: newP1Card,
        scorecardP2: newP2Card,
        statusMessage: `Player ${state.turn} scored ${action.score} in ${action.category}!`,
      };
    }

    case 'ADVANCE_TURN': {
      if (state.phase !== 'TURN_TRANSITION') return state;
      const nextPlayer: PlayerNumber = state.turn === 1 ? 2 : 1;
      return {
        ...state,
        phase: 'INITIAL_ROLL',
        turn: nextPlayer,
        rollsRemaining: 3,
        dice: [
          { value: 1, held: false },
          { value: 2, held: false },
          { value: 3, held: false },
          { value: 4, held: false },
          { value: 5, held: false },
        ],
        statusMessage: `Player ${nextPlayer}'s turn. Roll the dice (3 rolls left)`,
      };
    }

    case 'RESTART_GAME':
      return createInitialYachtState();

    default:
      return state;
  }
};

export const YachtDice: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();
  const [state, dispatch] = useReducer(yachtReducer, undefined, createInitialYachtState);

  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync game status with context
  useEffect(() => {
    if (state.phase === 'GAME_OVER') {
      setGameStatus('finished');
    } else {
      setGameStatus('active');
    }
  }, [state.phase, setGameStatus]);

  // Turn transition timer
  useEffect(() => {
    if (state.phase === 'TURN_TRANSITION') {
      const timer = setTimeout(() => {
        dispatch({ type: 'ADVANCE_TURN' });
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [state.phase]);

  // Clean up roll interval on unmount
  useEffect(() => {
    return () => {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    };
  }, []);

  const totalsP1 = useMemo(() => computeTotals(state.scorecardP1), [state.scorecardP1]);
  const totalsP2 = useMemo(() => computeTotals(state.scorecardP2), [state.scorecardP2]);

  // Roll dice action
  const rollDice = useCallback(() => {
    if (
      (state.phase !== 'INITIAL_ROLL' && state.phase !== 'DECIDING') ||
      state.rollsRemaining <= 0 ||
      state.winner !== null
    ) {
      return;
    }

    dispatch({ type: 'START_ROLL' });
    triggerHaptic('medium');

    let ticks = 0;
    rollIntervalRef.current = setInterval(() => {
      ticks++;
      playTapSound();

      const jitter = state.dice.map((die) =>
        die.held ? die : { ...die, value: Math.floor(Math.random() * 6) + 1 }
      );
      dispatch({ type: 'SET_JITTER_DICE', dice: jitter });

      if (ticks >= 6) {
        if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
        const finalDice = state.dice.map((die) =>
          die.held ? die : { ...die, value: Math.floor(Math.random() * 6) + 1 }
        );
        triggerHaptic('light');
        dispatch({ type: 'FINISH_ROLL', finalDice });
      }
    }, 75);
  }, [state.phase, state.rollsRemaining, state.winner, state.dice]);

  // Toggle Die Hold
  const toggleHold = useCallback((index: number) => {
    if (state.phase !== 'DECIDING') return;
    triggerHaptic('light');
    playTapSound();
    dispatch({ type: 'TOGGLE_DIE_HOLD', index });
  }, [state.phase]);

  // Select Category to score
  const selectCategory = useCallback((key: CategoryKey) => {
    if (state.phase !== 'DECIDING') return;

    const currentCard = state.turn === 1 ? state.scorecardP1 : state.scorecardP2;
    if (currentCard[key] !== undefined) {
      triggerHaptic('light');
      return;
    }

    triggerHaptic('medium');
    playCaptureSound();

    const diceValues = state.dice.map((d) => d.value);
    const scoreAwarded = calculateScore(key, diceValues);
    dispatch({ type: 'SCORE_CATEGORY', category: key, score: scoreAwarded });
  }, [state.phase, state.turn, state.scorecardP1, state.scorecardP2, state.dice]);

  // Reset Game
  const resetGame = useCallback(() => {
    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    dispatch({ type: 'RESTART_GAME' });
  }, []);

  // SVG Die Face renderer
  const renderDieFace = (value: number) => {
    const pipCoords: Record<number, [number, number][]> = {
      1: [[50, 50]],
      2: [[28, 28], [72, 72]],
      3: [[28, 28], [50, 50], [72, 72]],
      4: [[28, 28], [72, 28], [28, 72], [72, 72]],
      5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
      6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
    };

    const pips = pipCoords[value] || [];

    return (
      <svg viewBox="0 0 100 100" className="w-full h-full pointer-events-none select-none">
        <defs>
          <radialGradient id={`yachtPip-${value}`} cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor={value === 1 ? '#ef4444' : '#1e293b'} />
            <stop offset="70%" stopColor={value === 1 ? '#b91c1c' : '#0f172a'} />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
          <linearGradient id={`yachtSheen-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="18"
          fill="#fbfbfa"
          stroke="#cbd5e1"
          strokeWidth="2.5"
        />

        <path
          d="M 4 22 Q 4 4 22 4 L 75 4 Q 4 4 4 75 Z"
          fill={`url(#yachtSheen-${value})`}
          pointerEvents="none"
        />

        {pips.map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy + 0.8} r={value === 1 ? 12.5 : 8.8} fill="rgba(0,0,0,0.35)" />
            <circle
              cx={cx}
              cy={cy}
              r={value === 1 ? 12 : 8.2}
              fill={`url(#yachtPip-${value})`}
            />
            <circle cx={cx - 2} cy={cy - 2} r="1.5" fill="#ffffff" opacity="0.6" />
          </g>
        ))}
      </svg>
    );
  };

  const activeCard = state.turn === 1 ? state.scorecardP1 : state.scorecardP2;
  const currentDiceValues = useMemo(() => state.dice.map((d) => d.value), [state.dice]);
  const isRolling = state.phase === 'ROLLING';

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden">
      <GameHeader
        title="Yacht Dice"
        subtitle="12-Category Classic"
        turn={state.turn}
        scoreP1={totalsP1.total}
        scoreP2={totalsP2.total}
        p1Label="P1 Score"
        p2Label="P2 Score"
        onRestart={resetGame}
        statusMessage={state.statusMessage}
      />

      {/* Main Container: Split Layout with Dice on Left, Scorecard on Right */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden select-none">
        <div className="w-full max-w-md sm:max-w-2xl md:max-w-3xl h-full flex flex-row gap-2 sm:gap-4 overflow-hidden">
          {/* LEFT COLUMN: Vertical Dice Tray & Roll Controls */}
          <div className="w-24 sm:w-32 md:w-36 flex flex-col justify-between items-center bg-container-dark/95 border border-[#3e444c] rounded-3xl sm:rounded-[32px] p-2 sm:p-3 clubhouse-board-depth shadow-2xl flex-shrink-0">
            <div className="text-center w-full">
              <span className="text-[10px] sm:text-xs md:text-sm font-black tracking-wider text-accent-light/80 uppercase block">
                Dice
              </span>
              <span className="text-[9px] sm:text-[10px] font-semibold text-amber-400 block leading-tight">
                {state.phase === 'INITIAL_ROLL'
                  ? 'Roll to start'
                  : state.phase === 'DECIDING'
                  ? 'Tap to hold'
                  : isRolling
                  ? 'Rolling...'
                  : 'Turn ended'}
              </span>
            </div>

            {/* 5 Vertical Dice Stack in Physical Tray */}
            <div className="flex flex-col justify-around items-center w-full flex-1 py-1 gap-1.5 sm:gap-2.5">
              {state.dice.map((die, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleHold(idx)}
                  disabled={state.phase !== 'DECIDING'}
                  className={`relative w-12 h-12 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-2xl sm:rounded-3xl p-1 sm:p-1.5 transition-spring duration-200 ${
                    die.held
                      ? 'translate-x-1.5 -translate-y-1 ring-3 ring-amber-400 scale-105 bg-amber-50 table-lifted'
                      : 'bg-white table-flat hover:scale-102 active:scale-95'
                  } ${isRolling && !die.held ? 'animate-dice-roll' : ''} ${
                    state.phase !== 'DECIDING' ? 'cursor-default' : 'cursor-pointer'
                  }`}
                  aria-label={`Die ${idx + 1}: ${die.value} ${die.held ? 'held' : ''}`}
                >
                  {renderDieFace(die.value)}
                  {die.held && (
                    <span className="absolute -top-1.5 -right-1 bg-amber-500 text-black text-[8px] sm:text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-md uppercase tracking-tighter ring-1 ring-white">
                      HELD
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Roll Button at Bottom of Left Column */}
            <div className="w-full pt-1">
              <button
                onClick={rollDice}
                type="button"
                disabled={
                  (state.phase !== 'INITIAL_ROLL' && state.phase !== 'DECIDING') ||
                  state.rollsRemaining <= 0 ||
                  state.winner !== null
                }
                className={`w-full py-2.5 sm:py-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wider flex flex-col items-center justify-center gap-0.5 shadow-md transition-all ${
                  (state.phase === 'INITIAL_ROLL' || state.phase === 'DECIDING') &&
                  state.rollsRemaining > 0 &&
                  state.winner === null
                    ? state.turn === 1
                      ? 'bg-player-1 hover:bg-blue-600 text-white active:scale-95 shadow-blue-500/30 cursor-pointer'
                      : 'bg-player-2 hover:bg-red-600 text-white active:scale-95 shadow-red-500/30 cursor-pointer'
                    : 'bg-gray-600 text-gray-300 opacity-50 cursor-not-allowed'
                }`}
              >
                <svg className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span className="leading-none">{isRolling ? 'Rolling...' : 'Roll'}</span>
                <span className="text-[8px] opacity-80 leading-none">({state.rollsRemaining} left)</span>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Yacht Scorecard Paper Table */}
          <div className="flex-1 flex flex-col justify-between bg-[#fdfaf5] rounded-3xl p-2.5 sm:p-3 border-2 border-[#d8c3a5]/80 table-flat text-container-dark text-xs overflow-hidden">
            {/* Header Row */}
            <div className="flex items-center justify-between pb-1.5 border-b border-[#2a2e33]/20 font-black tracking-wider text-[11px] sm:text-xs">
              <span className="w-1/3">Category</span>
              <span className={`w-1/3 text-center ${state.turn === 1 ? 'text-player-1 font-black underline' : 'text-stone-600'}`}>
                P1 {state.turn === 1 && '★'}
              </span>
              <span className={`w-1/3 text-center ${state.turn === 2 ? 'text-player-2 font-black underline' : 'text-stone-600'}`}>
                P2 {state.turn === 2 && '★'}
              </span>
            </div>

            {/* Scorecard Rows Scrollable */}
            <div className="flex-1 overflow-y-auto py-1 space-y-0.5 scrollbar-none">
              {/* Upper Section */}
              <div className="text-[9px] font-black uppercase tracking-wider text-[#7d6753] pt-0.5">
                Upper Section
              </div>
              {CATEGORIES.filter((c) => c.section === 'upper').map((cat) => {
                const p1Val = state.scorecardP1[cat.key];
                const p2Val = state.scorecardP2[cat.key];
                const isFilled = activeCard[cat.key] !== undefined;
                const canSelect = state.phase === 'DECIDING' && !isFilled && state.winner === null;
                const potentialScore = calculateScore(cat.key, currentDiceValues);

                return (
                  <div
                    key={cat.key}
                    onClick={() => canSelect && selectCategory(cat.key)}
                    className={`flex items-center justify-between py-1 px-1.5 rounded-lg border transition-all ${
                      canSelect
                        ? 'hover:bg-amber-100/80 cursor-pointer border-dashed border-amber-400 bg-amber-50/40'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="w-1/3 flex flex-col leading-none">
                      <span className="font-bold text-[11px] sm:text-xs">{cat.name}</span>
                      <span className="text-[8px] text-[#7d6753] truncate">{cat.desc}</span>
                    </div>

                    {/* P1 Value or preview */}
                    <div className="w-1/3 text-center font-mono-digital font-black text-xs">
                      {p1Val !== undefined ? (
                        <span className="text-player-1">{p1Val}</span>
                      ) : state.turn === 1 && canSelect ? (
                        <span className="text-amber-600/70 font-semibold text-[10px]">+{potentialScore}</span>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </div>

                    {/* P2 Value or preview */}
                    <div className="w-1/3 text-center font-mono-digital font-black text-xs">
                      {p2Val !== undefined ? (
                        <span className="text-player-2">{p2Val}</span>
                      ) : state.turn === 2 && canSelect ? (
                        <span className="text-amber-600/70 font-semibold text-[10px]">+{potentialScore}</span>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Upper Bonus Subtotal Bar */}
              <div className="flex items-center justify-between py-0.5 px-1.5 bg-[#ebdcc9]/50 rounded-md text-[10px] font-bold border border-[#d8c3a5]/40">
                <span className="w-1/3 text-[#7d6753]">Bonus (63+ &#8594; +35)</span>
                <span className="w-1/3 text-center font-mono-digital font-black text-player-1">
                  {totalsP1.upperSum}/63 {totalsP1.upperBonus > 0 && '(+35)'}
                </span>
                <span className="w-1/3 text-center font-mono-digital font-black text-player-2">
                  {totalsP2.upperSum}/63 {totalsP2.upperBonus > 0 && '(+35)'}
                </span>
              </div>

              {/* Lower Section */}
              <div className="text-[9px] font-black uppercase tracking-wider text-[#7d6753] pt-1">
                Lower Section
              </div>
              {CATEGORIES.filter((c) => c.section === 'lower').map((cat) => {
                const p1Val = state.scorecardP1[cat.key];
                const p2Val = state.scorecardP2[cat.key];
                const isFilled = activeCard[cat.key] !== undefined;
                const canSelect = state.phase === 'DECIDING' && !isFilled && state.winner === null;
                const potentialScore = calculateScore(cat.key, currentDiceValues);

                return (
                  <div
                    key={cat.key}
                    onClick={() => canSelect && selectCategory(cat.key)}
                    className={`flex items-center justify-between py-1 px-1.5 rounded-lg border transition-all ${
                      canSelect
                        ? 'hover:bg-amber-100/80 cursor-pointer border-dashed border-amber-400 bg-amber-50/40'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="w-1/3 flex flex-col leading-none">
                      <span className="font-bold text-[11px] sm:text-xs">{cat.name}</span>
                      <span className="text-[8px] text-[#7d6753] truncate">{cat.desc}</span>
                    </div>

                    {/* P1 Value or preview */}
                    <div className="w-1/3 text-center font-mono-digital font-black text-xs">
                      {p1Val !== undefined ? (
                        <span className="text-player-1">{p1Val}</span>
                      ) : state.turn === 1 && canSelect ? (
                        <span className="text-amber-600/70 font-semibold text-[10px]">+{potentialScore}</span>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </div>

                    {/* P2 Value or preview */}
                    <div className="w-1/3 text-center font-mono-digital font-black text-xs">
                      {p2Val !== undefined ? (
                        <span className="text-player-2">{p2Val}</span>
                      ) : state.turn === 2 && canSelect ? (
                        <span className="text-amber-600/70 font-semibold text-[10px]">+{potentialScore}</span>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grand Total Footer Row */}
            <div className="flex items-center justify-between pt-1.5 border-t-2 border-[#2a2e33]/30 font-black text-xs sm:text-sm bg-container-dark text-accent-light px-2.5 py-1.5 rounded-xl shadow-inner shrink-0">
              <span className="w-1/3 uppercase tracking-wider text-[10px] sm:text-xs">
                Total
              </span>
              <span className="w-1/3 text-center font-mono-digital font-black text-blue-300">
                {totalsP1.total}
              </span>
              <span className="w-1/3 text-center font-mono-digital font-black text-rose-300">
                {totalsP2.total}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Instructions */}
      <footer className="pb-safe px-4 py-1.5 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>Roll up to 3 times per turn • Tap open scorecard row to score</span>
        <span className="text-[11px] bg-accent-light px-2.5 py-0.5 rounded-full border border-[#d8c3a5]/50">
          Target: High Score
        </span>
      </footer>

      {/* Game Over Modal */}
      {state.winner !== null && (
        <GameOverModal
          winner={state.winner}
          gameName="Yacht Dice"
          stats={[
            {
              label: 'Final Score',
              p1Value: `${totalsP1.total} Pts`,
              p2Value: `${totalsP2.total} Pts`,
            },
            {
              label: 'Upper Bonus',
              p1Value: totalsP1.upperBonus > 0 ? '+35 Pts' : '0 Pts',
              p2Value: totalsP2.upperBonus > 0 ? '+35 Pts' : '0 Pts',
            },
            {
              label: 'Yacht 50s',
              p1Value: state.scorecardP1.yacht === 50 ? 'Achieved' : 'None',
              p2Value: state.scorecardP2.yacht === 50 ? 'Achieved' : 'None',
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};

export default YachtDice;
