import React, { useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playTapSound, playCaptureSound, playGlassTinkSound } from '../utils/feedback';

// Board layout:
// Pits 0..5: Player 1 pits (bottom row, left to right 0->5)
// Pit 6: Player 1 store (right side)
// Pits 7..12: Player 2 pits (top row, right to left 7->12, or visually 12..7 left to right)
// Pit 13: Player 2 store (left side)

const INITIAL_BOARD = [
  4, 4, 4, 4, 4, 4, // 0-5: P1 pits
  0,                // 6: P1 store
  4, 4, 4, 4, 4, 4, // 7-12: P2 pits
  0                 // 13: P2 store
];

export const Mancala: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  const [board, setBoard] = useState<number[]>(INITIAL_BOARD);
  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [winner, setWinner] = useState<PlayerNumber | 'draw' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1: Select a pit to sow');
  const [lastExtraTurn, setLastExtraTurn] = useState<boolean>(false);
  const [activeDropPit, setActiveDropPit] = useState<number | null>(null);
  const [isSowing, setIsSowing] = useState<boolean>(false);

  const resetGame = useCallback(() => {
    setBoard(INITIAL_BOARD);
    setTurn(1);
    setWinner(null);
    setStatusMessage('Player 1: Select a pit to sow');
    setLastExtraTurn(false);
    setShowTurnTransition(false);
    setActiveDropPit(null);
    setIsSowing(false);
    setGameStatus('active');
  }, [setGameStatus]);

  // Check end conditions: when one player's 6 pits are empty
  const checkGameOver = useCallback((currentBoard: number[]) => {
    const p1Empty = currentBoard.slice(0, 6).every((stones) => stones === 0);
    const p2Empty = currentBoard.slice(7, 13).every((stones) => stones === 0);

    if (p1Empty || p2Empty) {
      const finalBoard = [...currentBoard];

      // Sweep remaining P1 stones into P1 store (6)
      for (let i = 0; i < 6; i++) {
        finalBoard[6] += finalBoard[i];
        finalBoard[i] = 0;
      }

      // Sweep remaining P2 stones into P2 store (13)
      for (let i = 7; i < 13; i++) {
        finalBoard[13] += finalBoard[i];
        finalBoard[i] = 0;
      }

      const p1Score = finalBoard[6];
      const p2Score = finalBoard[13];

      let winResult: PlayerNumber | 'draw' = 'draw';
      let message = `Game Over! Tie game (${p1Score} - ${p2Score})`;
      if (p1Score > p2Score) {
        winResult = 1;
        message = `Game Over! Player 1 Wins! (${p1Score} to ${p2Score})`;
      } else if (p2Score > p1Score) {
        winResult = 2;
        message = `Game Over! Player 2 Wins! (${p2Score} to ${p1Score})`;
      }

      setBoard(finalBoard);
      setWinner(winResult);
      setStatusMessage(message);
      setGameStatus('finished');
      return true;
    }
    return false;
  }, [setGameStatus]);

  const handlePitClick = useCallback((pitIndex: number) => {
    if (winner !== null || isSowing) return;

    // Validate ownership
    if (turn === 1 && (pitIndex < 0 || pitIndex > 5)) return;
    if (turn === 2 && (pitIndex < 7 || pitIndex > 12)) return;

    // Validate non-empty
    if (board[pitIndex] === 0) {
      setStatusMessage('Cannot select an empty pit!');
      triggerHaptic('light');
      return;
    }

    triggerHaptic('light');
    playTapSound();
    setIsSowing(true);

    // Compute sowing trajectory
    const initialStones = board[pitIndex];
    const steps: number[] = [];
    let curr = pitIndex;
    const p1Store = 6;
    const p2Store = 13;

    for (let s = 0; s < initialStones; s++) {
      curr = (curr + 1) % 14;
      if (turn === 1 && curr === p2Store) {
        curr = (curr + 1) % 14;
      } else if (turn === 2 && curr === p1Store) {
        curr = (curr + 1) % 14;
      }
      steps.push(curr);
    }

    // Immediately pick up stones from the selected pit
    const tempBoard = [...board];
    tempBoard[pitIndex] = 0;
    setBoard([...tempBoard]);

    // Animate procedural stone sowing pit by pit
    const stepDuration = 180; // ms per pit
    steps.forEach((targetPit, stepIndex) => {
      setTimeout(() => {
        tempBoard[targetPit]++;
        setBoard([...tempBoard]);
        setActiveDropPit(targetPit);
        playGlassTinkSound();
        triggerHaptic('light');

        // Once last stone lands, resolve captures, extra turns, and game over
        if (stepIndex === steps.length - 1) {
          setTimeout(() => {
            setActiveDropPit(null);
            setIsSowing(false);

            const lastLandedIndex = targetPit;
            let extraTurn = false;
            let captureOccurred = false;

            // Rule 1: Extra Turn if last stone lands in player's own store
            if ((turn === 1 && lastLandedIndex === p1Store) || (turn === 2 && lastLandedIndex === p2Store)) {
              extraTurn = true;
            } 
            // Rule 2: Capture rule if last stone lands in an empty pit owned by player, and opposite pit has stones
            else {
              const isP1OwnPit = turn === 1 && lastLandedIndex >= 0 && lastLandedIndex <= 5;
              const isP2OwnPit = turn === 2 && lastLandedIndex >= 7 && lastLandedIndex <= 12;

              if ((isP1OwnPit || isP2OwnPit) && tempBoard[lastLandedIndex] === 1) {
                const oppositeIndex = 12 - lastLandedIndex;
                const oppositeStones = tempBoard[oppositeIndex];

                if (oppositeStones > 0) {
                  captureOccurred = true;
                  const capturedTotal = oppositeStones + 1;
                  tempBoard[lastLandedIndex] = 0;
                  tempBoard[oppositeIndex] = 0;

                  if (turn === 1) {
                    tempBoard[p1Store] += capturedTotal;
                  } else {
                    tempBoard[p2Store] += capturedTotal;
                  }
                }
              }
            }

            if (captureOccurred) {
              playCaptureSound();
              triggerHaptic('medium');
            }

            setBoard([...tempBoard]);

            // Check game over
            const isOver = checkGameOver(tempBoard);
            if (!isOver) {
              if (extraTurn) {
                setLastExtraTurn(true);
                setStatusMessage(`Player ${turn} landed in store! Free extra turn!`);
              } else {
                setLastExtraTurn(false);
                const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
                setTurn(nextPlayer);
                setGameStatus('active');
                setStatusMessage(
                  captureOccurred
                    ? `Player ${turn} captured stones! Player ${nextPlayer}'s turn.`
                    : `Player ${nextPlayer}'s turn.`
                );
              }
            }
          }, 450);
        }
      }, (stepIndex + 1) * stepDuration);
    });
  }, [board, turn, winner, isSowing, checkGameOver, setGameStatus]);

  // Procedural marble rendering inside pits with large tactile 3D spheres
  const renderMarbles = (count: number, isStore = false, isDropActive = false) => {
    if (count === 0) return null;
    const marbles = [];
    const displayCount = Math.min(count, isStore ? 28 : 10);
    // Vibrant, rich gem marble palette: sapphire, emerald, amber, ruby, amethyst, topaz
    const marbleThemes = [
      { id: 'sapphire', base: '#0284c7', light: '#7dd3fc', dark: '#0369a1', glow: '#38bdf8' },
      { id: 'emerald', base: '#059669', light: '#6ee7b7', dark: '#065f46', glow: '#34d399' },
      { id: 'amber', base: '#d97706', light: '#fde68a', dark: '#92400e', glow: '#fbbf24' },
      { id: 'ruby', base: '#e11d48', light: '#fecdd3', dark: '#9f1239', glow: '#fb7185' },
      { id: 'amethyst', base: '#9333ea', light: '#e9d5ff', dark: '#6b21a8', glow: '#c084fc' },
      { id: 'topaz', base: '#ea580c', light: '#ffedd5', dark: '#9a3412', glow: '#fb923c' },
    ];

    // SVG Defs for translucent glass cabochon refraction gradients
    const defs = (
      <defs key="defs">
        {marbleThemes.map((theme) => (
          <radialGradient
            key={theme.id}
            id={`marbleGrad-${theme.id}`}
            cx="32%"
            cy="28%"
            r="72%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="22%" stopColor={theme.light} stopOpacity="0.9" />
            <stop offset="60%" stopColor={theme.base} stopOpacity="0.95" />
            <stop offset="85%" stopColor={theme.dark} stopOpacity="0.98" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="1" />
          </radialGradient>
        ))}
      </defs>
    );

    marbles.push(defs);

    // Dynamic placement based on count to ensure marbles cluster realistically and are large
    for (let i = 0; i < displayCount; i++) {
      let cx = 50;
      let cy = 50;
      const theme = marbleThemes[i % marbleThemes.length];
      const marbleRadius = isStore ? 7.2 : 8.8; // Much larger marbles (was 4px)

      if (displayCount === 1) {
        cx = 50;
        cy = 50;
      } else if (displayCount === 2) {
        cx = i === 0 ? 40 : 60;
        cy = 50;
      } else if (displayCount === 3) {
        const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
        cx = 50 + 13 * Math.cos(angles[i]);
        cy = 50 + 13 * Math.sin(angles[i]);
      } else if (displayCount === 4) {
        // Classic diamond cluster
        const positions = [
          [50, 36],
          [36, 50],
          [64, 50],
          [50, 64],
        ];
        cx = positions[i][0];
        cy = positions[i][1];
      } else {
        // Organic radial spiral clustering
        const angle = (i / displayCount) * 2 * Math.PI + (i % 2) * 0.4;
        const dist = isStore
          ? (i % 2 === 0 ? 11 : 20)
          : (i % 2 === 0 ? 8 : 17);
        cx = 50 + dist * Math.cos(angle);
        cy = 50 + dist * Math.sin(angle);
      }

      marbles.push(
        <g key={i} className={isDropActive && i === displayCount - 1 ? 'animate-sow-bounce' : ''}>
          {/* Subtle drop shadow cast onto curved base of pit */}
          <ellipse
            cx={cx + 1.2}
            cy={cy + marbleRadius * 0.45}
            rx={marbleRadius * 0.92}
            ry={marbleRadius * 0.55}
            fill="rgba(0, 0, 0, 0.45)"
          />
          {/* Main Glossy Glass Sphere */}
          <circle
            cx={cx}
            cy={cy}
            r={marbleRadius}
            fill={`url(#marbleGrad-${theme.id})`}
            stroke="rgba(255, 255, 255, 0.75)"
            strokeWidth="0.8"
            className="clubhouse-piece-shadow"
          />
          {/* Top-left bright specular reflection dot */}
          <circle
            cx={cx - marbleRadius * 0.36}
            cy={cy - marbleRadius * 0.36}
            r={marbleRadius * 0.28}
            fill="#ffffff"
            opacity="0.88"
          />
          {/* Secondary subtle crescent refraction rim */}
          <circle
            cx={cx + marbleRadius * 0.2}
            cy={cy + marbleRadius * 0.2}
            r={marbleRadius * 0.35}
            fill={theme.light}
            opacity="0.25"
          />
        </g>
      );
    }

    return marbles;
  };

  const isPlayablePit = (index: number) => {
    if (winner !== null || isSowing) return false;
    if (turn === 1 && index >= 0 && index <= 5 && board[index] > 0) return true;
    if (turn === 2 && index >= 7 && index <= 12 && board[index] > 0) return true;
    return false;
  };

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden">
      <GameHeader
        title="Mancala"
        subtitle="Ancient 2-Player Kalah"
        turn={turn}
        scoreP1={board[6]}
        scoreP2={board[13]}
        p1Label="P1 (Bottom)"
        p2Label="P2 (Top)"
        onRestart={resetGame}
        statusMessage={statusMessage}
      />

      {/* Mancala Playing Board Container - Scalable across iPhone, iPad, and PC */}
      <main className="flex-1 flex flex-col items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-hidden">
        <div className="w-full max-w-sm sm:max-w-xl md:max-w-2xl bg-gradient-to-br from-[#d4a373] via-[#c59160] to-[#b88655] border-4 sm:border-6 border-[#8c5932] rounded-[36px] sm:rounded-[44px] clubhouse-board-depth table-flat p-3 sm:p-5 flex flex-col justify-between gap-2.5 sm:gap-4 relative transition-all">
          
          {/* Wooden Bevel & Grain Overlay */}
          <div className="absolute inset-0 rounded-[32px] sm:rounded-[40px] bg-gradient-to-tr from-black/25 via-transparent to-white/20 pointer-events-none" />

          {/* Top Label: Player 2 indicator */}
          <div className="flex items-center justify-between px-3 text-[11px] sm:text-xs font-black tracking-wider uppercase z-10">
            <span className={`flex items-center gap-1.5 ${turn === 2 ? 'text-player-2 animate-pulse' : 'text-stone-900/80'}`}>
              <span className="w-2.5 h-2.5 rounded-full bg-player-2 ring-2 ring-player-2/40" />
              Player 2 Pits (Top)
            </span>
            <span className="text-stone-900 font-bold bg-white/40 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-white/30 shadow-sm">
              P2 Store: {board[13]}
            </span>
          </div>

          {/* Main Mancala Trough Layout */}
          <div className="flex items-center justify-between gap-2 sm:gap-3.5 z-10">
            {/* Player 2 Store (Left) - Carved Deep Oval Hollow */}
            <div 
              style={{ background: 'radial-gradient(ellipse at 45% 35%, #42220d 0%, #241105 75%, #5a3014 100%)' }}
              className={`flex flex-col items-center justify-center w-14 sm:w-20 md:w-24 h-48 sm:h-64 md:h-72 rounded-full p-1.5 sm:p-2 border-2 sm:border-3 border-[#241105] table-recess relative transition-transform ${
                activeDropPit === 13 ? 'scale-105 animate-pit-drop ring-4 ring-player-2' : ''
              }`}
            >
              <span className="absolute top-2 sm:top-3 text-[10px] sm:text-xs font-black text-player-2 tracking-widest uppercase">
                P2
              </span>
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {renderMarbles(board[13], true, activeDropPit === 13)}
              </svg>
              <div className="absolute bottom-2 sm:bottom-3 bg-black/75 text-white font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-full border border-white/20 shadow-md">
                {board[13]}
              </div>
            </div>

            {/* Central 2x6 Pit Grid */}
            <div className="flex-1 flex flex-col justify-between gap-2.5 sm:gap-4 h-48 sm:h-64 md:h-72">
              {/* Row 2: Player 2 Pits (12 downto 7 from left to right) */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5">
                {[12, 11, 10, 9, 8, 7].map((pitIndex) => {
                  const playable = isPlayablePit(pitIndex);
                  const isDropping = activeDropPit === pitIndex;
                  return (
                    <button
                      key={pitIndex}
                      type="button"
                      onClick={() => handlePitClick(pitIndex)}
                      disabled={!playable}
                      style={{ background: 'radial-gradient(circle at 45% 35%, #42220d 0%, #241105 75%, #5a3014 100%)' }}
                      className={`relative aspect-square rounded-full flex flex-col items-center justify-center p-1 sm:p-1.5 border-2 sm:border-3 table-recess transition-all duration-150 ${
                        isDropping
                          ? 'border-amber-300 ring-4 ring-amber-400 scale-110 animate-pit-drop z-20'
                          : playable
                          ? 'border-player-2/80 ring-2 ring-player-2/50 hover:scale-105 active:scale-95 cursor-pointer'
                          : 'border-[#241105] opacity-90'
                      }`}
                      aria-label={`Player 2 pit ${pitIndex}, ${board[pitIndex]} stones`}
                    >
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        {renderMarbles(board[pitIndex], false, isDropping)}
                      </svg>
                      <span className="absolute bottom-0.5 sm:bottom-1 text-[10px] sm:text-xs md:text-sm font-black text-white bg-black/75 px-1.5 sm:px-2 py-0.2 rounded-full border border-white/20 shadow-sm">
                        {board[pitIndex]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Row 1: Player 1 Pits (0 upto 5 from left to right) */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5">
                {[0, 1, 2, 3, 4, 5].map((pitIndex) => {
                  const playable = isPlayablePit(pitIndex);
                  const isDropping = activeDropPit === pitIndex;
                  return (
                    <button
                      key={pitIndex}
                      type="button"
                      onClick={() => handlePitClick(pitIndex)}
                      disabled={!playable}
                      style={{ background: 'radial-gradient(circle at 45% 35%, #42220d 0%, #241105 75%, #5a3014 100%)' }}
                      className={`relative aspect-square rounded-full flex flex-col items-center justify-center p-1 sm:p-1.5 border-2 sm:border-3 table-recess transition-all duration-150 ${
                        isDropping
                          ? 'border-amber-300 ring-4 ring-amber-400 scale-110 animate-pit-drop z-20'
                          : playable
                          ? 'border-player-1/80 ring-2 ring-player-1/50 hover:scale-105 active:scale-95 cursor-pointer'
                          : 'border-[#241105] opacity-90'
                      }`}
                      aria-label={`Player 1 pit ${pitIndex}, ${board[pitIndex]} stones`}
                    >
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        {renderMarbles(board[pitIndex], false, isDropping)}
                      </svg>
                      <span className="absolute bottom-0.5 sm:bottom-1 text-[10px] sm:text-xs md:text-sm font-black text-white bg-black/75 px-1.5 sm:px-2 py-0.2 rounded-full border border-white/20 shadow-sm">
                        {board[pitIndex]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Player 1 Store (Right) - Carved Deep Oval Hollow */}
            <div 
              style={{ background: 'radial-gradient(ellipse at 45% 35%, #42220d 0%, #241105 75%, #5a3014 100%)' }}
              className={`flex flex-col items-center justify-center w-14 sm:w-20 md:w-24 h-48 sm:h-64 md:h-72 rounded-full p-1.5 sm:p-2 border-2 sm:border-3 border-[#241105] table-recess relative transition-transform ${
                activeDropPit === 6 ? 'scale-105 animate-pit-drop ring-4 ring-player-1' : ''
              }`}
            >
              <span className="absolute top-2 sm:top-3 text-[10px] sm:text-xs font-black text-player-1 tracking-widest uppercase">
                P1
              </span>
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {renderMarbles(board[6], true, activeDropPit === 6)}
              </svg>
              <div className="absolute bottom-2 sm:bottom-3 bg-black/75 text-white font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-full border border-white/20 shadow-md">
                {board[6]}
              </div>
            </div>
          </div>

          {/* Bottom Label: Player 1 indicator */}
          <div className="flex items-center justify-between px-3 text-[11px] sm:text-xs font-black tracking-wider uppercase">
            <span className={`flex items-center gap-1.5 ${turn === 1 ? 'text-player-1 animate-pulse' : 'text-white/60'}`}>
              <span className="w-2.5 h-2.5 rounded-full bg-player-1 ring-2 ring-player-1/40" />
              Player 1 Pits (Bottom)
            </span>
            <span className="text-white/80 font-bold">
              Store: {board[6]}
            </span>
          </div>
        </div>
      </main>

      {/* Footer Instructions / Extra Turn Notification */}
      <footer className="pb-safe px-4 py-2 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>
          {lastExtraTurn ? '⭐ Extra Turn active!' : 'Sow stones counterclockwise'}
        </span>
        <span className="text-[11px] bg-accent-light px-2.5 py-1 rounded-full border border-[#d8c3a5]/50">
          Target: Most Captured
        </span>
      </footer>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Mancala"
          stats={[
            { label: 'Store (Captured)', p1Value: board[6], p2Value: board[13] },
            {
              label: 'Total Collected',
              p1Value: board[6],
              p2Value: board[13],
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
