import React, { useState, useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playTapSound, playCaptureSound } from '../utils/feedback';

interface Die {
  value: number; // 1-6
  held: boolean;
}

// 12 Scoring Categories
type CategoryKey =
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

interface CategoryDef {
  key: CategoryKey;
  name: string;
  section: 'upper' | 'lower';
  desc: string;
}

const CATEGORIES: CategoryDef[] = [
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

type Scorecard = Partial<Record<CategoryKey, number>>;

export const YachtDice: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  // Initial dice: 5 unheld random or 1s
  const [dice, setDice] = useState<Die[]>([
    { value: 1, held: false },
    { value: 2, held: false },
    { value: 3, held: false },
    { value: 4, held: false },
    { value: 5, held: false },
  ]);

  const [rollsRemaining, setRollsRemaining] = useState<number>(3);
  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [scorecardP1, setScorecardP1] = useState<Scorecard>({});
  const [scorecardP2, setScorecardP2] = useState<Scorecard>({});
  const [winner, setWinner] = useState<PlayerNumber | 'draw' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Roll the dice (3 rolls left)');
  const [isRolling, setIsRolling] = useState<boolean>(false);

  // Score calculation engine
  const calculateScore = useCallback((key: CategoryKey, values: number[]): number => {
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
        // 4 sequential: 1-2-3-4, 2-3-4-5, or 3-4-5-6
        const uniqueSorted = Array.from(new Set(values)).sort((a, b) => a - b);
        const str = uniqueSorted.join('');
        const hasSmall = str.includes('1234') || str.includes('2345') || str.includes('3456');
        return hasSmall ? 30 : 0;
      }
      case 'largeStraight': {
        // 5 sequential: 1-2-3-4-5 or 2-3-4-5-6
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
  }, []);

  // Compute upper sum, bonus, and totals
  const computeTotals = useCallback((card: Scorecard) => {
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
  }, []);

  const totalsP1 = useMemo(() => computeTotals(scorecardP1), [scorecardP1, computeTotals]);
  const totalsP2 = useMemo(() => computeTotals(scorecardP2), [scorecardP2, computeTotals]);

  // Roll action with rolling animation & rapid audio feedback
  const rollDice = useCallback(() => {
    if (rollsRemaining <= 0 || winner !== null || isRolling) return;

    setIsRolling(true);
    triggerHaptic('medium');

    // Rapid audio feedback & interim face jitter
    let ticks = 0;
    const rollInterval = setInterval(() => {
      ticks++;
      playTapSound();
      setDice((prev) =>
        prev.map((die) => (die.held ? die : { ...die, value: Math.floor(Math.random() * 6) + 1 }))
      );

      if (ticks >= 6) {
        clearInterval(rollInterval);
        // Final roll values
        setDice((prev) =>
          prev.map((die) => (die.held ? die : { ...die, value: Math.floor(Math.random() * 6) + 1 }))
        );
        setIsRolling(false);
        triggerHaptic('light');

        const nextRolls = rollsRemaining - 1;
        setRollsRemaining(nextRolls);

        if (nextRolls === 0) {
          setStatusMessage(`No rolls left! Player ${turn}: Tap a category to score.`);
        } else {
          setStatusMessage(`Player ${turn}: Hold dice or roll again (${nextRolls} left).`);
        }
      }
    }, 75);
  }, [rollsRemaining, winner, isRolling, turn]);

  // Toggle Hold
  const toggleHold = useCallback((index: number) => {
    // Only allow holds after at least 1 roll has been made and while not rolling
    if (rollsRemaining === 3 || winner !== null || isRolling) return;

    triggerHaptic('light');
    playTapSound();

    setDice((prev) =>
      prev.map((die, i) => (i === index ? { ...die, held: !die.held } : die))
    );
  }, [rollsRemaining, winner, isRolling]);

  // Select category to score
  const selectCategory = useCallback((key: CategoryKey) => {
    if (winner !== null || isRolling) return;
    if (rollsRemaining === 3) {
      setStatusMessage('You must roll at least once before scoring!');
      triggerHaptic('light');
      return;
    }

    const currentCard = turn === 1 ? scorecardP1 : scorecardP2;
    if (currentCard[key] !== undefined) {
      setStatusMessage('Category already filled! Select another.');
      triggerHaptic('light');
      return;
    }

    triggerHaptic('medium');
    playCaptureSound();

    const diceValues = dice.map((d) => d.value);
    const scoreAwarded = calculateScore(key, diceValues);

    const nextCard = { ...currentCard, [key]: scoreAwarded };
    if (turn === 1) setScorecardP1(nextCard);
    else setScorecardP2(nextCard);

    // Check if game has finished (both players filled all 12 categories)
    const p1Keys = Object.keys(turn === 1 ? nextCard : scorecardP1).length;
    const p2Keys = Object.keys(turn === 2 ? nextCard : scorecardP2).length;

    if (p1Keys === 12 && p2Keys === 12) {
      // Calculate final totals
      const finalP1 = computeTotals(turn === 1 ? nextCard : scorecardP1).total;
      const finalP2 = computeTotals(turn === 2 ? nextCard : scorecardP2).total;

      let winResult: PlayerNumber | 'draw' = 'draw';
      let endMsg = `Game Over! Tie (${finalP1} - ${finalP2})`;
      if (finalP1 > finalP2) {
        winResult = 1;
        endMsg = `🎉 Player 1 Wins with ${finalP1} points!`;
      } else if (finalP2 > finalP1) {
        winResult = 2;
        endMsg = `🎉 Player 2 Wins with ${finalP2} points!`;
      }

      setWinner(winResult);
      setStatusMessage(endMsg);
      setGameStatus('finished');
      return;
    }

    // Switch turn smoothly
    const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
    setTurn(nextPlayer);
    setRollsRemaining(3);
    setDice([
      { value: 1, held: false },
      { value: 2, held: false },
      { value: 3, held: false },
      { value: 4, held: false },
      { value: 5, held: false },
    ]);
    setGameStatus('active');
    setStatusMessage(`Player ${nextPlayer}'s turn. Roll the dice (3 rolls left)`);
  }, [
    winner,
    isRolling,
    rollsRemaining,
    turn,
    scorecardP1,
    scorecardP2,
    dice,
    calculateScore,
    computeTotals,
    setGameStatus,
  ]);

  const resetGame = useCallback(() => {
    setScorecardP1({});
    setScorecardP2({});
    setDice([
      { value: 1, held: false },
      { value: 2, held: false },
      { value: 3, held: false },
      { value: 4, held: false },
      { value: 5, held: false },
    ]);
    setRollsRemaining(3);
    setTurn(1);
    setWinner(null);
    setStatusMessage('Player 1: Roll the dice (3 rolls left)');
    setShowTurnTransition(false);
    setIsRolling(false);
    setGameStatus('active');
  }, [setGameStatus]);

  // SVG Die Face renderer with soft corners, recessed pips, and glossy face reflection
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
          {/* Deep recessed pip gradient */}
          <radialGradient id={`yachtPip-${value}`} cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor={value === 1 ? '#ef4444' : '#1e293b'} />
            <stop offset="70%" stopColor={value === 1 ? '#b91c1c' : '#0f172a'} />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
          {/* Acrylic glossy face sweep */}
          <linearGradient id={`yachtSheen-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Soft rounded acrylic cube body */}
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

        {/* Glossy face reflection sweep */}
        <path
          d="M 4 22 Q 4 4 22 4 L 75 4 Q 4 4 4 75 Z"
          fill={`url(#yachtSheen-${value})`}
          pointerEvents="none"
        />

        {/* Deep recessed circular pips with inner shading */}
        {pips.map(([cx, cy], i) => (
          <g key={i}>
            {/* Pip recess shadow */}
            <circle cx={cx} cy={cy + 0.8} r={value === 1 ? 12.5 : 8.8} fill="rgba(0,0,0,0.35)" />
            {/* Pip fill */}
            <circle
              cx={cx}
              cy={cy}
              r={value === 1 ? 12 : 8.2}
              fill={`url(#yachtPip-${value})`}
            />
            {/* Pip highlight */}
            <circle cx={cx - 2} cy={cy - 2} r="1.5" fill="#ffffff" opacity="0.6" />
          </g>
        ))}
      </svg>
    );
  };

  const activeCard = turn === 1 ? scorecardP1 : scorecardP2;
  const currentDiceValues = useMemo(() => dice.map((d) => d.value), [dice]);

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden">
      <GameHeader
        title="Yacht Dice"
        subtitle="12-Category Classic"
        turn={turn}
        scoreP1={totalsP1.total}
        scoreP2={totalsP2.total}
        p1Label="P1 Score"
        p2Label="P2 Score"
        onRestart={resetGame}
        statusMessage={statusMessage}
      />

      {/* Main Container: Split Layout with Dice on Left, Scorecard on Right - Responsive on iPhone, iPad, PC */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden select-none">
        <div className="w-full max-w-md sm:max-w-2xl md:max-w-3xl h-full flex flex-row gap-2 sm:gap-4 overflow-hidden">
          {/* LEFT COLUMN: Vertical Dice Tray & Roll Controls */}
          <div className="w-24 sm:w-32 md:w-36 flex flex-col justify-between items-center bg-container-dark/95 border border-[#3e444c] rounded-3xl sm:rounded-[32px] p-2 sm:p-3 clubhouse-board-depth shadow-2xl flex-shrink-0">
            <div className="text-center w-full">
              <span className="text-[10px] sm:text-xs md:text-sm font-black tracking-wider text-accent-light/80 uppercase block">
                Dice
              </span>
              <span className="text-[9px] sm:text-[10px] font-semibold text-amber-400 block leading-tight">
                {rollsRemaining < 3 ? 'Tap to hold' : 'Roll to start'}
              </span>
            </div>

            {/* 5 Vertical Dice Stack in Physical Tray */}
            <div className="flex flex-col justify-around items-center w-full flex-1 py-1 gap-1.5 sm:gap-2.5">
              {dice.map((die, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleHold(idx)}
                  disabled={rollsRemaining === 3 || winner !== null || isRolling}
                  className={`relative w-12 h-12 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-2xl sm:rounded-3xl p-1 sm:p-1.5 transition-spring duration-200 ${
                  die.held
                    ? 'translate-x-1.5 -translate-y-1 ring-3 ring-amber-400 scale-105 bg-amber-50 table-lifted'
                    : 'bg-white table-flat hover:scale-102 active:scale-95'
                } ${isRolling && !die.held ? 'animate-dice-roll' : ''}`}
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
              disabled={rollsRemaining <= 0 || winner !== null || isRolling}
              className={`w-full py-2.5 sm:py-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-wider flex flex-col items-center justify-center gap-0.5 shadow-md transition-all ${
                rollsRemaining > 0 && winner === null && !isRolling
                  ? turn === 1
                    ? 'bg-player-1 hover:bg-blue-600 text-white active:scale-95 shadow-blue-500/30'
                    : 'bg-player-2 hover:bg-red-600 text-white active:scale-95 shadow-red-500/30'
                  : 'bg-gray-600 text-gray-300 opacity-50 cursor-not-allowed'
              }`}
            >
              <svg className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span className="leading-none">{isRolling ? 'Rolling...' : 'Roll'}</span>
              <span className="text-[8px] opacity-80 leading-none">({rollsRemaining} left)</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Yacht Scorecard Paper Table */}
        <div className="flex-1 flex flex-col justify-between bg-[#fdfaf5] rounded-3xl p-2.5 sm:p-3 border-2 border-[#d8c3a5]/80 table-flat text-container-dark text-xs overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-1 text-[11px] sm:text-xs font-extrabold pb-1.5 border-b border-[#2a2e33]/15 text-[#6e5845] uppercase tracking-wide">
            <span className="col-span-6">Category</span>
            <span className="col-span-3 text-center text-player-1 font-black">P1</span>
            <span className="col-span-3 text-center text-player-2 font-black">P2</span>
          </div>

          {/* Categories List (Scrollable if needed, fits easily in vertical view) */}
          <div className="divide-y divide-[#2a2e33]/10 overflow-y-auto flex-1 pr-1 py-0.5 scrollbar-none">
            {CATEGORIES.map((cat, idx) => {
              const p1Score = scorecardP1[cat.key];
              const p2Score = scorecardP2[cat.key];
              const isTurnCategory = activeCard[cat.key] === undefined && rollsRemaining < 3 && winner === null && !isRolling;
              const previewScore = isTurnCategory ? calculateScore(cat.key, currentDiceValues) : null;
              const isUpperDivider = idx === 5; // Visual separator between upper and lower section

              return (
                <div key={cat.key}>
                  <div
                    onClick={() => isTurnCategory && selectCategory(cat.key)}
                    className={`grid grid-cols-12 gap-1 py-1 sm:py-1.5 px-1.5 rounded-xl items-center transition-all ${
                      isTurnCategory
                        ? 'hover:bg-amber-200/60 active:bg-amber-300/80 cursor-pointer bg-white/40 shadow-sm border border-amber-200/50'
                        : 'opacity-90'
                    }`}
                  >
                    <div className="col-span-6 flex flex-col">
                      <span className="font-bold text-[11px] sm:text-xs leading-tight text-container-dark">
                        {cat.name}
                      </span>
                      <span className="text-[9px] text-[#846b54] truncate">{cat.desc}</span>
                    </div>

                    {/* Player 1 Column */}
                    <div className="col-span-3 text-center font-bold">
                      {p1Score !== undefined ? (
                        <span className="text-container-dark text-xs sm:text-sm font-black">{p1Score}</span>
                      ) : turn === 1 && previewScore !== null ? (
                        <span className="text-player-1 font-black text-[11px] sm:text-xs bg-blue-100/90 px-1.5 py-0.5 rounded-md border border-blue-300 animate-pulse inline-block">
                          +{previewScore}
                        </span>
                      ) : (
                        <span className="text-gray-300 font-light">-</span>
                      )}
                    </div>

                    {/* Player 2 Column */}
                    <div className="col-span-3 text-center font-bold">
                      {p2Score !== undefined ? (
                        <span className="text-container-dark text-xs sm:text-sm font-black">{p2Score}</span>
                      ) : turn === 2 && previewScore !== null ? (
                        <span className="text-player-2 font-black text-[11px] sm:text-xs bg-red-100/90 px-1.5 py-0.5 rounded-md border border-red-300 animate-pulse inline-block">
                          +{previewScore}
                        </span>
                      ) : (
                        <span className="text-gray-300 font-light">-</span>
                      )}
                    </div>
                  </div>

                  {/* Upper Section Bonus Preview Bar */}
                  {isUpperDivider && (
                    <div className="my-1 py-0.5 px-2 bg-[#2a2e33]/5 rounded-lg flex items-center justify-between text-[10px] font-bold text-[#6e5845]">
                      <span>Upper Bonus (&ge;63 &rarr; +35)</span>
                      <div className="flex gap-4">
                        <span className="text-player-1">{totalsP1.upperSum}/63 {totalsP1.upperBonus > 0 && '✓'}</span>
                        <span className="text-player-2">{totalsP2.upperSum}/63 {totalsP2.upperBonus > 0 && '✓'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total Sums Footer in Scorecard */}
          <div className="pt-1.5 border-t border-[#2a2e33]/20 flex items-center justify-between text-xs font-black">
            <span className="text-[#6e5845] uppercase tracking-wider text-[10px] sm:text-[11px]">
              Total Score
            </span>
            <div className="flex gap-4 pr-2">
              <span className="text-player-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                P1: {totalsP1.total}
              </span>
              <span className="text-player-2 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                P2: {totalsP2.total}
              </span>
            </div>
          </div>
        </div>
        </div>
      </main>

      {/* Footer Safe Area */}
      <footer className="pb-safe px-4 py-1.5 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>Tap an open category row to lock in score</span>
        <span className="text-[11px] bg-accent-light px-2.5 py-0.5 rounded-full border border-[#d8c3a5]/50">
          Target: High Score
        </span>
      </footer>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Yacht Dice"
          stats={[
            {
              label: 'Total Score',
              p1Value: `${totalsP1.total} pts`,
              p2Value: `${totalsP2.total} pts`,
            },
            {
              label: 'Upper Bonus (+35)',
              p1Value: totalsP1.upperBonus > 0 ? 'Achieved' : 'Missed',
              p2Value: totalsP2.upperBonus > 0 ? 'Achieved' : 'Missed',
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
