import React, { useState, useCallback, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playTapSound, playCaptureSound } from '../utils/feedback';

// 8x8 Grid
// 0 = empty, 1 = P1 (Dark/Black), 2 = P2 (Light/White)
type Disc = 0 | 1 | 2;

const BOARD_SIZE = 8;

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export const Renegade: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  // Initial standard Reversi center setup:
  // [3,3]=2 (White), [3,4]=1 (Black), [4,3]=1 (Black), [4,4]=2 (White)
  const createInitialBoard = (): Disc[][] => {
    const b: Disc[][] = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    b[3][3] = 2;
    b[3][4] = 1;
    b[4][3] = 1;
    b[4][4] = 2;
    return b;
  };

  const [board, setBoard] = useState<Disc[][]>(createInitialBoard);
  const [turn, setTurn] = useState<PlayerNumber>(1); // P1 starts (Dark)
  const [winner, setWinner] = useState<PlayerNumber | 'draw' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1 (Dark): Tap a highlighted square');
  const [lastFlipped, setLastFlipped] = useState<[number, number][]>([]);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  // Count discs
  const { p1Count, p2Count } = useMemo(() => {
    let p1 = 0;
    let p2 = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === 1) p1++;
        else if (board[r][c] === 2) p2++;
      }
    }
    return { p1Count: p1, p2Count: p2 };
  }, [board]);

  // Determine flips in all 8 directions from (r, c) for a given player
  const getFlipsForMove = useCallback((b: Disc[][], r: number, c: number, player: PlayerNumber): [number, number][] => {
    if (b[r][c] !== 0) return [];
    const opponent: PlayerNumber = player === 1 ? 2 : 1;
    const flips: [number, number][] = [];

    for (const [dr, dc] of DIRECTIONS) {
      let step = 1;
      const potentialFlips: [number, number][] = [];

      while (true) {
        const nr = r + dr * step;
        const nc = c + dc * step;

        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;

        const currentCell = b[nr][nc];
        if (currentCell === opponent) {
          potentialFlips.push([nr, nc]);
          step++;
        } else if (currentCell === player) {
          // Bounded by player's piece: all intermediate opponent pieces are captured!
          if (potentialFlips.length > 0) {
            flips.push(...potentialFlips);
          }
          break;
        } else {
          // Empty cell: no trap
          break;
        }
      }
    }

    return flips;
  }, []);

  // Compute all valid coordinates for the active player
  const validMovesMap = useMemo(() => {
    const map = new Map<string, [number, number][]>();
    if (winner !== null) return map;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const flips = getFlipsForMove(board, r, c, turn);
        if (flips.length > 0) {
          map.set(`${r},${c}`, flips);
        }
      }
    }
    return map;
  }, [board, turn, winner, getFlipsForMove]);

  const resetGame = useCallback(() => {
    setBoard(createInitialBoard());
    setTurn(1);
    setWinner(null);
    setLastFlipped([]);
    setStatusMessage('Player 1 (Dark): Tap a highlighted square');
    setGameStatus('active');
  }, [setGameStatus]);

  // Check board & moves to advance or conclude game
  const handleCellClick = useCallback((r: number, c: number) => {
    if (winner !== null || isAnimating) return;

    const flips = validMovesMap.get(`${r},${c}`);
    if (!flips || flips.length === 0) return;

    triggerHaptic('medium');
    playTapSound();
    playCaptureSound();

    // Apply move & flips immediately to visual board
    const nextBoard = board.map((row) => [...row]);
    nextBoard[r][c] = turn;
    for (const [fr, fc] of flips) {
      nextBoard[fr][fc] = turn;
    }

    setBoard(nextBoard);
    setLastFlipped([[r, c], ...flips]);
    setIsAnimating(true);

    const opponent: PlayerNumber = turn === 1 ? 2 : 1;

    // Check if opponent has any valid moves
    let opponentHasMoves = false;
    for (let or_ = 0; or_ < BOARD_SIZE; or_++) {
      for (let oc = 0; oc < BOARD_SIZE; oc++) {
        if (getFlipsForMove(nextBoard, or_, oc, opponent).length > 0) {
          opponentHasMoves = true;
          break;
        }
      }
      if (opponentHasMoves) break;
    }

    // Check if original player still has moves in case opponent must pass
    let currentHasMoves = false;
    for (let cr = 0; cr < BOARD_SIZE; cr++) {
      for (let cc = 0; cc < BOARD_SIZE; cc++) {
        if (getFlipsForMove(nextBoard, cr, cc, turn).length > 0) {
          currentHasMoves = true;
          break;
        }
      }
      if (currentHasMoves) break;
    }

    // Delay settle by 350ms so players watch the disc-flip transition
    setTimeout(() => {
      setIsAnimating(false);

      // Case 1: Opponent can move -> regular turn switch
      if (opponentHasMoves) {
        setTurn(opponent);
        setGameStatus('active');
        setStatusMessage(`Player ${opponent}'s turn (${opponent === 1 ? 'Dark' : 'Light'}).`);
        return;
      }

      // Case 2: Opponent has no moves, but current player has moves -> auto-pass (no swap to opponent)
      if (currentHasMoves) {
        setStatusMessage(`Player ${opponent} has no moves! Auto-passed back to Player ${turn}.`);
        return;
      }

      // Case 3: Neither player has moves (or board full) -> Game Over!
      let finalP1 = 0;
      let finalP2 = 0;
      for (let fr = 0; fr < BOARD_SIZE; fr++) {
        for (let fc = 0; fc < BOARD_SIZE; fc++) {
          if (nextBoard[fr][fc] === 1) finalP1++;
          else if (nextBoard[fr][fc] === 2) finalP2++;
        }
      }

      let winResult: PlayerNumber | 'draw' = 'draw';
      let endMsg = `Game Over! Tie (${finalP1} - ${finalP2})`;
      if (finalP1 > finalP2) {
        winResult = 1;
        endMsg = `🎉 Player 1 (Dark) Wins with ${finalP1} discs!`;
      } else if (finalP2 > finalP1) {
        winResult = 2;
        endMsg = `🎉 Player 2 (Light) Wins with ${finalP2} discs!`;
      }

      setWinner(winResult);
      setStatusMessage(endMsg);
      setGameStatus('finished');
    }, 350);
  }, [board, turn, winner, isAnimating, validMovesMap, getFlipsForMove, setGameStatus]);

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden">
      <GameHeader
        title="Renegade"
        subtitle="Classic 8x8 Reversi"
        turn={turn}
        scoreP1={p1Count}
        scoreP2={p2Count}
        p1Label="P1 (Dark)"
        p2Label="P2 (Light)"
        onRestart={resetGame}
        statusMessage={statusMessage}
      />

      {/* Main Board Arena - Responsive on iPhone, iPad, PC */}
      <main className="flex-1 flex flex-col items-center justify-center p-2.5 sm:p-4 md:p-6">
        {/* Felt Green Reversi Board with Wooden Rim */}
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl aspect-square max-h-[72vh] bg-emerald-900 rounded-3xl sm:rounded-[36px] p-2.5 sm:p-4 md:p-5 clubhouse-board-depth border-4 sm:border-6 border-[#14532d] flex flex-col justify-between relative">
          
          {/* Subtle felt surface texture gradient */}
          <div className="absolute inset-0 rounded-[20px] sm:rounded-[28px] bg-gradient-to-tr from-black/30 via-transparent to-white/10 pointer-events-none" />

          {/* 8x8 Tile Grid */}
          <div className="grid grid-cols-8 grid-rows-8 gap-1 w-full h-full z-10">
            {board.map((row, r) =>
              row.map((cell, c) => {
                const isValid = validMovesMap.has(`${r},${c}`);
                const isJustFlipped = lastFlipped.some(([fr, fc]) => fr === r && fc === c);

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onClick={() => handleCellClick(r, c)}
                    disabled={!isValid || winner !== null}
                    className={`relative rounded-md flex items-center justify-center transition-all bg-emerald-800/90 clubhouse-inset-recess ${
                      isValid
                        ? 'hover:bg-emerald-700 active:scale-95 cursor-pointer ring-1 ring-emerald-400/50'
                        : ''
                    }`}
                    aria-label={`Row ${r + 1}, Col ${c + 1}`}
                  >
                    {/* Empty cell with valid move indicator dot */}
                    {cell === 0 && isValid && (
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-300/90 shadow-md animate-pulse" />
                    )}

                    {/* Disc */}
                    {cell !== 0 && (
                      <div
                        className={`w-[85%] h-[85%] rounded-full clubhouse-piece-shadow flex items-center justify-center transition-transform duration-300 ${
                          isJustFlipped ? 'scale-110' : 'scale-100'
                        } ${
                          cell === 1
                            ? 'bg-gradient-to-br from-[#334155] to-[#0f172a] border border-[#475569]'
                            : 'bg-gradient-to-br from-[#ffffff] to-[#e2e8f0] border border-[#cbd5e1]'
                        }`}
                      >
                        {/* Tactile concentric groove */}
                        <div
                          className={`w-3/5 h-3/5 rounded-full border shadow-inner ${
                            cell === 1 ? 'border-white/20 bg-slate-900/40' : 'border-black/15 bg-white/40'
                          }`}
                        />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Footer Instructions */}
      <footer className="pb-safe px-4 py-2 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>Trap opponent pieces between yours to flip</span>
        <span className="text-[11px] bg-accent-light px-2.5 py-1 rounded-full border border-[#d8c3a5]/50">
          Target: Most Discs
        </span>
      </footer>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Renegade"
          stats={[
            {
              label: 'Final Disc Count',
              p1Value: `${p1Count} (Dark)`,
              p2Value: `${p2Count} (Light)`,
            },
            {
              label: 'Board Control',
              p1Value: `${Math.round((p1Count / 64) * 100)}%`,
              p2Value: `${Math.round((p2Count / 64) * 100)}%`,
            },
          ]}
          onRestart={resetGame}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};
