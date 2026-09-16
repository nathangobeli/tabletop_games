import React, { useState, useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playCaptureSound, playWoodClackSound } from '../utils/feedback';

// 24 Points (indices 0..23, corresponding to traditional points 1..24)
// Point state: { count: number, player: PlayerNumber | 0 }
// Movement:
// Player 1 moves from high indices (23) down toward Home Board (0..5), then bears off.
// Player 2 moves from low indices (0) up toward Home Board (18..23), then bears off.
// Bar: captured checkers awaiting re-entry
// BorneOff: total checkers successfully removed from board (out of 15)

interface PointState {
  count: number;
  player: PlayerNumber | 0;
}

// Initial standard Backgammon board setup (15 checkers each)
const getInitialPoints = (): PointState[] => {
  const pts: PointState[] = Array.from({ length: 24 }, () => ({ count: 0, player: 0 }));
  // Point indices (0-indexed):
  // P1 moves 23 -> 0:
  // - 2 on pt 23 (Point 24)
  // - 5 on pt 12 (Point 13)
  // - 3 on pt 7 (Point 8)
  // - 5 on pt 5 (Point 6)
  pts[23] = { count: 2, player: 1 };
  pts[12] = { count: 5, player: 1 };
  pts[7] = { count: 3, player: 1 };
  pts[5] = { count: 5, player: 1 };

  // P2 moves 0 -> 23:
  // - 2 on pt 0 (Point 1)
  // - 5 on pt 11 (Point 12)
  // - 3 on pt 16 (Point 17)
  // - 5 on pt 18 (Point 19)
  pts[0] = { count: 2, player: 2 };
  pts[11] = { count: 5, player: 2 };
  pts[16] = { count: 3, player: 2 };
  pts[18] = { count: 5, player: 2 };

  return pts;
};

export const Backgammon: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  const [points, setPoints] = useState<PointState[]>(getInitialPoints);
  const [barP1, setBarP1] = useState<number>(0);
  const [barP2, setBarP2] = useState<number>(0);
  const [offP1, setOffP1] = useState<number>(0);
  const [offP2, setOffP2] = useState<number>(0);

  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [dice, setDice] = useState<number[]>([3, 5]);
  const [movesRemaining, setMovesRemaining] = useState<number[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | 'bar' | null>(null);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Roll the dice to start turn');

  const resetGame = useCallback(() => {
    setPoints(getInitialPoints());
    setBarP1(0);
    setBarP2(0);
    setOffP1(0);
    setOffP2(0);
    setTurn(1);
    setDice([3, 5]);
    setMovesRemaining([]);
    setSelectedPoint(null);
    setWinner(null);
    setShowTurnTransition(false);
    playWoodClackSound();
    setStatusMessage('Player 1: Roll the dice to start turn');
    setGameStatus('active');
  }, [setGameStatus]);

  // Check if player has all active pieces in their home board
  const isHomeBoardReady = useCallback((player: PlayerNumber, pts: PointState[], barCount: number) => {
    if (barCount > 0) return false;

    if (player === 1) {
      // Home board is points 0..5. Check if any checker outside 0..5
      for (let i = 6; i < 24; i++) {
        if (pts[i].player === 1 && pts[i].count > 0) return false;
      }
      return true;
    } else {
      // Home board is points 18..23. Check if any checker outside 18..23
      for (let i = 0; i < 18; i++) {
        if (pts[i].player === 2 && pts[i].count > 0) return false;
      }
      return true;
    }
  }, []);

  // Determine valid destinations from selected position
  const getDestinations = useCallback((from: number | 'bar', player: PlayerNumber, availableMoves: number[]): { targetIndex: number | 'off'; dieVal: number }[] => {
    const destinations: { targetIndex: number | 'off'; dieVal: number }[] = [];
    const opponent: PlayerNumber = player === 1 ? 2 : 1;
    const canBearOff = isHomeBoardReady(player, points, player === 1 ? barP1 : barP2);

    const uniqueDice = Array.from(new Set(availableMoves));

    for (const die of uniqueDice) {
      if (from === 'bar') {
        // Re-entering:
        // P1 re-enters at high points (24 - die = index 24 - die)
        // P2 re-enters at low points (die - 1)
        const targetPt = player === 1 ? 24 - die : die - 1;
        const target = points[targetPt];

        // A point is open if empty, owned by player, or single opponent blot
        if (target.player !== opponent || target.count <= 1) {
          destinations.push({ targetIndex: targetPt, dieVal: die });
        }
      } else {
        // Regular point move
        const targetPt = player === 1 ? from - die : from + die;

        // Check normal movement
        if (targetPt >= 0 && targetPt < 24) {
          const target = points[targetPt];
          if (target.player !== opponent || target.count <= 1) {
            destinations.push({ targetIndex: targetPt, dieVal: die });
          }
        }
        // Check bearing off
        else if (canBearOff) {
          if (player === 1 && targetPt < 0) {
            // Exact die or highest checker
            if (targetPt === -1 || from === Math.max(...points.map((p, idx) => (p.player === 1 && p.count > 0 ? idx : -1)))) {
              destinations.push({ targetIndex: 'off', dieVal: die });
            }
          } else if (player === 2 && targetPt >= 24) {
            if (targetPt === 24 || from === Math.min(...points.map((p, idx) => (p.player === 2 && p.count > 0 ? idx : 25)))) {
              destinations.push({ targetIndex: 'off', dieVal: die });
            }
          }
        }
      }
    }

    return destinations;
  }, [points, barP1, barP2, isHomeBoardReady]);

  // Tactile Die Renderer Helper
  const renderTactileDie = (d: number, key?: number | string) => (
    <div
      key={key}
      className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center filter drop-shadow-md bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] border border-slate-300 shadow-sm"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full select-none">
        <rect x="5" y="5" width="90" height="90" rx="18" fill="#fbfbfa" stroke="#cbd5e1" strokeWidth="3" />
        <path d="M 5 22 Q 5 5 22 5 L 75 5 Q 5 5 5 75 Z" fill="rgba(255,255,255,0.7)" />
        {(d === 1 || d === 3 || d === 5) && (
          <circle cx="50" cy="50" r={d === 1 ? '11' : '8'} fill={d === 1 ? '#ef4444' : '#1e293b'} />
        )}
        {(d === 2 || d === 3 || d === 4 || d === 5 || d === 6) && (
          <>
            <circle cx="28" cy="28" r="8" fill="#1e293b" />
            <circle cx="72" cy="72" r="8" fill="#1e293b" />
          </>
        )}
        {(d === 4 || d === 5 || d === 6) && (
          <>
            <circle cx="72" cy="28" r="8" fill="#1e293b" />
            <circle cx="28" cy="72" r="8" fill="#1e293b" />
          </>
        )}
        {d === 6 && (
          <>
            <circle cx="28" cy="50" r="8" fill="#1e293b" />
            <circle cx="72" cy="50" r="8" fill="#1e293b" />
          </>
        )}
      </svg>
    </div>
  );

  // Roll Dice Action
  const rollDice = useCallback(() => {
    if (movesRemaining.length > 0 || winner !== null) return;

    triggerHaptic('medium');
    playWoodClackSound();

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    setDice([d1, d2]);

    // Doubles rule: 4 moves instead of 2
    const moves = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
    setMovesRemaining(moves);

    // Auto-select bar if player has checkers on bar
    const barCount = turn === 1 ? barP1 : barP2;
    if (barCount > 0) {
      setSelectedPoint('bar');
      setStatusMessage(`Player ${turn} rolled [${d1}, ${d2}]. You must re-enter from the Bar!`);
    } else {
      setSelectedPoint(null);
      setStatusMessage(`Player ${turn} rolled [${d1}, ${d2}]. Select a checker to move.`);
    }
  }, [movesRemaining.length, winner, turn, barP1, barP2]);

  // Compute all valid targets for current selection
  const validTargets = useMemo(() => {
    if (selectedPoint === null || movesRemaining.length === 0) return [];
    return getDestinations(selectedPoint, turn, movesRemaining);
  }, [selectedPoint, movesRemaining, turn, getDestinations]);

  // Check if player has any legal moves remaining with dice
  const hasAnyLegalMoves = useCallback((player: PlayerNumber, moves: number[], pts: PointState[], p1Bar: number, p2Bar: number) => {
    const barCount = player === 1 ? p1Bar : p2Bar;
    if (barCount > 0) {
      return getDestinations('bar', player, moves).length > 0;
    }

    for (let i = 0; i < 24; i++) {
      if (pts[i].player === player && pts[i].count > 0) {
        if (getDestinations(i, player, moves).length > 0) {
          return true;
        }
      }
    }
    return false;
  }, [getDestinations]);

  // Finish turn handler
  const endTurn = useCallback(() => {
    const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
    setTurn(nextPlayer);
    setMovesRemaining([]);
    setSelectedPoint(null);
    setGameStatus('active');
    setStatusMessage(`Player ${nextPlayer}'s turn. Roll dice to start.`);
  }, [turn, setGameStatus]);

  // Execute Move
  const handleDestinationClick = useCallback((targetIndex: number | 'off', dieVal: number) => {
    if (selectedPoint === null || movesRemaining.length === 0 || winner !== null) return;

    const nextPoints = points.map((p) => ({ ...p }));
    let nextBarP1 = barP1;
    let nextBarP2 = barP2;
    let nextOffP1 = offP1;
    let nextOffP2 = offP2;
    const opponent: PlayerNumber = turn === 1 ? 2 : 1;

    // 1. Remove piece from origin
    if (selectedPoint === 'bar') {
      if (turn === 1) nextBarP1--;
      else nextBarP2--;
    } else {
      nextPoints[selectedPoint].count--;
      if (nextPoints[selectedPoint].count === 0) {
        nextPoints[selectedPoint].player = 0;
      }
    }

    // 2. Place piece at destination
    if (targetIndex === 'off') {
      // Borne off!
      if (turn === 1) nextOffP1++;
      else nextOffP2++;
      playCaptureSound();
      triggerHaptic('medium');

      // Check win: 15 checkers borne off
      if (nextOffP1 >= 15) {
        setOffP1(15);
        setWinner(1);
        setStatusMessage('🎉 Player 1 borne off all 15 checkers and wins!');
        setGameStatus('finished');
        return;
      }
      if (nextOffP2 >= 15) {
        setOffP2(15);
        setWinner(2);
        setStatusMessage('🎉 Player 2 borne off all 15 checkers and wins!');
        setGameStatus('finished');
        return;
      }
    } else {
      const targetPt = nextPoints[targetIndex];
      // Hit blot!
      if (targetPt.player === opponent && targetPt.count === 1) {
        if (opponent === 1) nextBarP1++;
        else nextBarP2++;
        targetPt.player = turn;
        targetPt.count = 1;
        playCaptureSound();
        triggerHaptic('medium');
      } else {
        targetPt.player = turn;
        targetPt.count++;
        playWoodClackSound();
        triggerHaptic('light');
      }
    }

    // 3. Deduct die
    const dieIdx = movesRemaining.indexOf(dieVal);
    const nextMoves = [...movesRemaining];
    if (dieIdx !== -1) {
      nextMoves.splice(dieIdx, 1);
    }

    setPoints(nextPoints);
    setBarP1(nextBarP1);
    setBarP2(nextBarP2);
    setOffP1(nextOffP1);
    setOffP2(nextOffP2);
    setMovesRemaining(nextMoves);

    // 4. Auto-advance turn or check further moves
    const currentBar = turn === 1 ? nextBarP1 : nextBarP2;
    if (nextMoves.length === 0) {
      endTurn();
    } else if (!hasAnyLegalMoves(turn, nextMoves, nextPoints, nextBarP1, nextBarP2)) {
      setStatusMessage(`No further legal moves for Player ${turn}. Turn passed.`);
      setTimeout(() => endTurn(), 800);
    } else {
      if (currentBar > 0) {
        setSelectedPoint('bar');
        setStatusMessage(`Player ${turn}: Continue re-entering checkers from the Bar.`);
      } else {
        setSelectedPoint(null);
        setStatusMessage(`Player ${turn}: ${nextMoves.length} move(s) remaining [${nextMoves.join(', ')}].`);
      }
    }
  }, [
    selectedPoint,
    movesRemaining,
    winner,
    points,
    barP1,
    barP2,
    offP1,
    offP2,
    turn,
    endTurn,
    hasAnyLegalMoves,
    setGameStatus,
  ]);

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden relative select-none">
      <GameHeader
        title="Backgammon"
        subtitle="Tables & Points"
        turn={turn}
        scoreP1={`${offP1}/15 Off`}
        scoreP2={`${offP2}/15 Off`}
        p1Label="P1 (Red)"
        p2Label="P2 (Dark)"
        onRestart={resetGame}
        statusMessage={statusMessage}
      />

      {/* Main Board Container - Responsive on iPhone, iPad, PC */}
      <main className="flex-1 flex flex-col items-center justify-between p-2 sm:p-4 md:p-6 relative overflow-hidden">
        {/* Top: Dice & Action Bar */}
        <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 bg-container-dark/95 border border-[#3e444c] rounded-2xl shadow-lg mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs font-black uppercase text-accent-light/70">
              Dice:
            </span>
            <div className="flex gap-2">
              {dice.map((d, i) => renderTactileDie(d, i))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Roll Dice Button */}
            <button
              onClick={rollDice}
              disabled={movesRemaining.length > 0 || winner !== null}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all ${
                movesRemaining.length === 0 && winner === null
                  ? turn === 1
                    ? 'bg-player-1 hover:bg-blue-600 text-white active:scale-95 shadow-md shadow-blue-500/30'
                    : 'bg-player-2 hover:bg-red-600 text-white active:scale-95 shadow-md shadow-red-500/30'
                  : 'bg-gray-600 text-gray-400 opacity-50 cursor-not-allowed'
              }`}
            >
              Roll Dice
            </button>
          </div>
        </div>

        {/* Center: Backgammon Board Table with Baize Felt Inlay */}
        <div className="my-auto w-full max-w-md sm:max-w-xl md:max-w-2xl aspect-[4/3] max-h-[65vh] bg-[#3a200e] rounded-3xl sm:rounded-[36px] p-2 sm:p-3.5 clubhouse-board-depth table-flat border-4 sm:border-6 border-[#241308] flex flex-col justify-between relative overflow-hidden">
          
          {/* Inner Hardwood Inlay Perimeter Trim */}
          <div className="w-full h-full rounded-2xl sm:rounded-3xl p-1 bg-gradient-to-br from-[#1b382b] via-[#142c22] to-[#0c1d16] border-2 border-[#8c5932]/40 shadow-inner flex flex-col justify-between relative">
          
          {/* Top Row of Points (Points 12..23, viewed left to right: 12..17 | BAR | 18..23) */}
          <div className="flex justify-between h-28 sm:h-36 md:h-44 relative">
            {/* Left Quad (Points 12..17) */}
            <div className="flex-1 grid grid-cols-6 h-full">
              {[12, 13, 14, 15, 16, 17].map((idx) => {
                const pt = points[idx];
                const isSelected = selectedPoint === idx;
                const dest = validTargets.find((t) => t.targetIndex === idx);
                const isOdd = idx % 2 === 1;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (dest) handleDestinationClick(dest.targetIndex, dest.dieVal);
                      else if (pt.player === turn && movesRemaining.length > 0) setSelectedPoint(idx);
                    }}
                    className="relative flex flex-col items-center justify-start h-full focus:outline-none"
                  >
                    {/* Triangular pip pointing down */}
                    <svg viewBox="0 0 40 100" preserveAspectRatio="none" className="w-full h-full absolute inset-0">
                      <polygon points="0,0 40,0 20,95" fill={isOdd ? '#991b1b' : '#1e293b'} />
                    </svg>

                    {/* Destination Highlight */}
                    {dest && (
                      <div className="absolute top-8 w-4 h-4 rounded-full bg-amber-400 shadow-md animate-pulse z-20" />
                    )}

                    {/* Checkers Stack with Turned-Wood Shading */}
                    <div className="z-10 flex flex-col -space-y-3.5 pt-1">
                      {Array.from({ length: Math.min(5, pt.count) }).map((_, ci) => (
                        <div
                          key={ci}
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full shadow-md transition-spring flex items-center justify-center ${
                            pt.player === 1
                              ? 'bg-gradient-to-br from-[#dc2626] via-[#991b1b] to-[#450a0a] border border-[#fca5a5]/40 shadow-[inset_0_1px_2px_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.6)]'
                              : 'bg-gradient-to-br from-[#334155] via-[#1e293b] to-[#020617] border border-[#94a3b8]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.8)]'
                          } ${isSelected ? 'ring-2 ring-yellow-400 scale-110 table-lifted' : ''}`}
                        >
                          <div className="w-[60%] h-[60%] rounded-full border border-black/25 shadow-inner" />
                        </div>
                      ))}
                      {pt.count > 5 && (
                        <span className="text-[9px] font-black text-white bg-black/75 px-1 rounded-full text-center shadow-sm">
                          +{pt.count - 5}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Central Wooden Bar Divider */}
            <div className="w-8 h-full bg-[#2f1b0a] mx-1 rounded-md flex flex-col items-center justify-center gap-2 border border-black/30 z-20">
              <span className="text-[8px] font-black text-white/50 uppercase tracking-widest rotate-90">
                BAR
              </span>
              {/* Checkers on Bar */}
              {barP1 > 0 && (
                <button
                  type="button"
                  onClick={() => turn === 1 && setSelectedPoint('bar')}
                  className={`w-5 h-5 rounded-full bg-player-1 border border-white text-white font-black text-[9px] flex items-center justify-center shadow-md ${
                    selectedPoint === 'bar' && turn === 1 ? 'ring-2 ring-yellow-400 animate-pulse' : ''
                  }`}
                >
                  {barP1}
                </button>
              )}
              {barP2 > 0 && (
                <button
                  type="button"
                  onClick={() => turn === 2 && setSelectedPoint('bar')}
                  className={`w-5 h-5 rounded-full bg-slate-900 border border-slate-300 text-white font-black text-[9px] flex items-center justify-center shadow-md ${
                    selectedPoint === 'bar' && turn === 2 ? 'ring-2 ring-yellow-400 animate-pulse' : ''
                  }`}
                >
                  {barP2}
                </button>
              )}
            </div>

            {/* Right Quad (Points 18..23) */}
            <div className="flex-1 grid grid-cols-6 h-full">
              {[18, 19, 20, 21, 22, 23].map((idx) => {
                const pt = points[idx];
                const isSelected = selectedPoint === idx;
                const dest = validTargets.find((t) => t.targetIndex === idx);
                const isOdd = idx % 2 === 1;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (dest) handleDestinationClick(dest.targetIndex, dest.dieVal);
                      else if (pt.player === turn && movesRemaining.length > 0) setSelectedPoint(idx);
                    }}
                    className="relative flex flex-col items-center justify-start h-full focus:outline-none"
                  >
                    <svg viewBox="0 0 40 100" preserveAspectRatio="none" className="w-full h-full absolute inset-0">
                      <polygon points="0,0 40,0 20,95" fill={isOdd ? '#991b1b' : '#1e293b'} />
                    </svg>

                    {dest && (
                      <div className="absolute top-8 w-4 h-4 rounded-full bg-amber-400 shadow-md animate-pulse z-20" />
                    )}

                    <div className="z-10 flex flex-col -space-y-3.5 pt-1">
                      {Array.from({ length: Math.min(5, pt.count) }).map((_, ci) => (
                        <div
                          key={ci}
                          className={`w-5 h-5 rounded-full shadow-md border ${
                            pt.player === 1
                              ? 'bg-player-1 border-white'
                              : 'bg-slate-900 border-slate-300'
                          } ${isSelected ? 'ring-2 ring-yellow-400' : ''}`}
                        />
                      ))}
                      {pt.count > 5 && (
                        <span className="text-[9px] font-black text-white bg-black/70 px-1 rounded-full text-center">
                          +{pt.count - 5}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Row of Points (Points 11 downto 0, viewed left to right: 11..6 | BAR | 5..0) */}
          <div className="flex justify-between h-28 relative">
            {/* Left Quad (Points 11 downto 6) */}
            <div className="flex-1 grid grid-cols-6 h-full">
              {[11, 10, 9, 8, 7, 6].map((idx) => {
                const pt = points[idx];
                const isSelected = selectedPoint === idx;
                const dest = validTargets.find((t) => t.targetIndex === idx);
                const isOdd = idx % 2 === 1;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (dest) handleDestinationClick(dest.targetIndex, dest.dieVal);
                      else if (pt.player === turn && movesRemaining.length > 0) setSelectedPoint(idx);
                    }}
                    className="relative flex flex-col items-center justify-end h-full focus:outline-none"
                  >
                    <svg viewBox="0 0 40 100" preserveAspectRatio="none" className="w-full h-full absolute inset-0">
                      <polygon points="0,100 40,100 20,5" fill={isOdd ? '#991b1b' : '#1e293b'} />
                    </svg>

                    {dest && (
                      <div className="absolute bottom-8 w-4 h-4 rounded-full bg-amber-400 shadow-md animate-pulse z-20" />
                    )}

                    <div className="z-10 flex flex-col-reverse -space-y-3.5 pb-1">
                      {Array.from({ length: Math.min(5, pt.count) }).map((_, ci) => (
                        <div
                          key={ci}
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full shadow-md transition-spring flex items-center justify-center ${
                            pt.player === 1
                              ? 'bg-gradient-to-br from-[#dc2626] via-[#991b1b] to-[#450a0a] border border-[#fca5a5]/40 shadow-[inset_0_1px_2px_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.6)]'
                              : 'bg-gradient-to-br from-[#334155] via-[#1e293b] to-[#020617] border border-[#94a3b8]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.8)]'
                          } ${isSelected ? 'ring-2 ring-yellow-400 scale-110 table-lifted' : ''}`}
                        >
                          <div className="w-[60%] h-[60%] rounded-full border border-black/25 shadow-inner" />
                        </div>
                      ))}
                      {pt.count > 5 && (
                        <span className="text-[9px] font-black text-white bg-black/75 px-1 rounded-full text-center shadow-sm">
                          +{pt.count - 5}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Central Bar Spacer */}
            <div className="w-8 h-full bg-[#2f1b0a] mx-1 rounded-md" />

            {/* Right Quad (Points 5 downto 0) */}
            <div className="flex-1 grid grid-cols-6 h-full">
              {[5, 4, 3, 2, 1, 0].map((idx) => {
                const pt = points[idx];
                const isSelected = selectedPoint === idx;
                const dest = validTargets.find((t) => t.targetIndex === idx);
                const isOdd = idx % 2 === 1;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (dest) handleDestinationClick(dest.targetIndex, dest.dieVal);
                      else if (pt.player === turn && movesRemaining.length > 0) setSelectedPoint(idx);
                    }}
                    className="relative flex flex-col items-center justify-end h-full focus:outline-none"
                  >
                    <svg viewBox="0 0 40 100" preserveAspectRatio="none" className="w-full h-full absolute inset-0">
                      <polygon points="0,100 40,100 20,5" fill={isOdd ? '#991b1b' : '#1e293b'} />
                    </svg>

                    {dest && (
                      <div className="absolute bottom-8 w-4 h-4 rounded-full bg-amber-400 shadow-md animate-pulse z-20" />
                    )}

                    <div className="z-10 flex flex-col-reverse -space-y-3.5 pb-1">
                      {Array.from({ length: Math.min(5, pt.count) }).map((_, ci) => (
                        <div
                          key={ci}
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full shadow-md transition-spring flex items-center justify-center ${
                            pt.player === 1
                              ? 'bg-gradient-to-br from-[#dc2626] via-[#991b1b] to-[#450a0a] border border-[#fca5a5]/40 shadow-[inset_0_1px_2px_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.6)]'
                              : 'bg-gradient-to-br from-[#334155] via-[#1e293b] to-[#020617] border border-[#94a3b8]/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.8)]'
                          } ${isSelected ? 'ring-2 ring-yellow-400 scale-110 table-lifted' : ''}`}
                        >
                          <div className="w-[60%] h-[60%] rounded-full border border-black/25 shadow-inner" />
                        </div>
                      ))}
                      {pt.count > 5 && (
                        <span className="text-[9px] font-black text-white bg-black/75 px-1 rounded-full text-center shadow-sm">
                          +{pt.count - 5}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bear Off Action Button if available */}
          {validTargets.some((t) => t.targetIndex === 'off') && (
            <button
              onClick={() => {
                const offTarget = validTargets.find((t) => t.targetIndex === 'off');
                if (offTarget) handleDestinationClick('off', offTarget.dieVal);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-30 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase shadow-xl animate-bounce"
            >
              Bear Off!
            </button>
          )}
          </div>
        </div>
      </main>

      {/* Footer Instructions */}
      <footer className="pb-safe px-4 py-1.5 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>Roll dice, select checker, and tap highlighted point</span>
        <span className="text-[11px] bg-accent-light px-2.5 py-0.5 rounded-full border border-[#d8c3a5]/50">
          Target: Bear Off 15
        </span>
      </footer>

      {/* Victory Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Backgammon"
          stats={[
            {
              label: 'Checkers Borne Off',
              p1Value: `${offP1} / 15`,
              p2Value: `${offP2} / 15`,
            },
            {
              label: 'Match Result',
              p1Value: winner === 1 ? 'Grand Master' : 'Runner Up',
              p2Value: winner === 2 ? 'Grand Master' : 'Runner Up',
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
