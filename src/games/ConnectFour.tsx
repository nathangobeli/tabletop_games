import React, { useState, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader, type GamePlayMode } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import { RemoteDuelModal } from '../components/RemoteDuelModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playBounceSound, playPlasticPlinkSound } from '../utils/feedback';
import { requestAIMove } from '../utils/aiClient';
import { multiplayer } from '../utils/multiplayer';

// 7 columns x 6 rows
const COLS = 7;
const ROWS = 6;

type CellValue = 0 | 1 | 2;
type WinningPosition = [number, number]; // [row, col]

interface C4Snapshot {
  grid: CellValue[][];
  turn: PlayerNumber;
  lastDropPos: { row: number; col: number } | null;
  statusMessage: string;
}

export const ConnectFour: React.FC = () => {
  const { setGameStatus, resetToMenu, setIsCpuThinking } = useGame();

  // Grid: 6 rows (0 is top, 5 is bottom), 7 cols
  const [grid, setGrid] = useState<CellValue[][]>(() =>
    Array.from({ length: ROWS }, () => Array(COLS).fill(0))
  );
  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [winner, setWinner] = useState<PlayerNumber | 'draw' | null>(null);
  const [winningCells, setWinningCells] = useState<WinningPosition[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1 (Cobalt): Pick a column');
  const [lastDropPos, setLastDropPos] = useState<{ row: number; col: number } | null>(null);
  const [fallingDisc, setFallingDisc] = useState<{ row: number; col: number; player: PlayerNumber; durationMs: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);

  // Modes & Multiplayer
  const [gameMode, setGameMode] = useState<GamePlayMode>('pass-and-play');
  const [showRemoteModal, setShowRemoteModal] = useState<boolean>(false);

  // State History for Undo
  const [history, setHistory] = useState<C4Snapshot[]>([]);

  // Live Score tracking across pass-and-play matches
  const [scoreP1, setScoreP1] = useState<number>(0);
  const [scoreP2, setScoreP2] = useState<number>(0);

  const resetGame = useCallback((isRemote = false) => {
    setGrid(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
    setTurn(1);
    setWinner(null);
    setWinningCells([]);
    setStatusMessage('Player 1 (Cobalt): Pick a column');
    setLastDropPos(null);
    setFallingDisc(null);
    setIsAnimating(false);
    setIsThinking(false);
    setHistory([]);
    setGameStatus('active');

    if (gameMode === 'remote' && !isRemote) {
      multiplayer.send({ type: 'RESTART' });
    }
  }, [gameMode, setGameStatus]);

  // Check 4-in-a-row in all 4 vectors from a given drop position
  const checkWinFrom = (
    currentGrid: CellValue[][],
    r: number,
    c: number,
    player: CellValue
  ): WinningPosition[] | null => {
    const directions = [
      [0, 1],  // Horizontal
      [1, 0],  // Vertical
      [1, 1],  // Diagonal \
      [1, -1], // Diagonal /
    ];

    for (const [dr, dc] of directions) {
      const line: WinningPosition[] = [[r, c]];

      // Positive direction
      let step = 1;
      while (true) {
        const nr = r + dr * step;
        const nc = c + dc * step;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && currentGrid[nr][nc] === player) {
          line.push([nr, nc]);
          step++;
        } else {
          break;
        }
      }

      // Negative direction
      step = 1;
      while (true) {
        const nr = r - dr * step;
        const nc = c - dc * step;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && currentGrid[nr][nc] === player) {
          line.push([nr, nc]);
          step++;
        } else {
          break;
        }
      }

      if (line.length >= 4) {
        return line;
      }
    }

    return null;
  };

  // Check board full draw condition
  const isBoardFull = (currentGrid: CellValue[][]) => {
    return currentGrid[0].every((cell) => cell !== 0);
  };

  const executeDrop = useCallback((colIndex: number, isRemote = false) => {
    if (winner !== null || isAnimating) return;

    // Check if column is already full (top cell occupied)
    if (grid[0][colIndex] !== 0) {
      setStatusMessage('Column is full! Choose another.');
      triggerHaptic('light');
      return;
    }

    // Find lowest available row in column
    let landingRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][colIndex] === 0) {
        landingRow = r;
        break;
      }
    }

    if (landingRow === -1) return;

    // Push current state to undo history
    setHistory((prev) => [...prev, { grid, turn, lastDropPos, statusMessage }]);

    // Send over WebRTC if in remote mode and triggered locally
    if (gameMode === 'remote' && !isRemote) {
      multiplayer.send({ type: 'MOVE', payload: { col: colIndex } });
    }

    // 1. Lock user inputs immediately while piece is in flight
    setIsAnimating(true);
    triggerHaptic('light');

    // 2. Compute dynamic fall timing based on target row depth
    const fallDurationMs = 380 + landingRow * 38;
    const currentTurn = turn;

    setFallingDisc({
      row: landingRow,
      col: colIndex,
      player: currentTurn,
      durationMs: fallDurationMs,
    });

    // 3. Impact sound timing: fire playPlasticPlinkSound exactly at landing impact
    const impactTimeMs = Math.round(fallDurationMs * 0.74);
    setTimeout(() => {
      triggerHaptic('medium');
      playPlasticPlinkSound();
      playBounceSound(480);
    }, impactTimeMs);

    setTimeout(() => {
      playBounceSound(360);
    }, impactTimeMs + 110);

    // 4. Smooth inline turn switch: no modal interruption
    setTimeout(() => {
      // Commit piece to permanent grid
      const newGrid = grid.map((row) => [...row]);
      newGrid[landingRow][colIndex] = currentTurn;
      setGrid(newGrid);
      setLastDropPos({ row: landingRow, col: colIndex });
      setFallingDisc(null);

      // Check win condition
      const winSequence = checkWinFrom(newGrid, landingRow, colIndex, currentTurn);

      if (winSequence) {
        setWinner(currentTurn);
        setWinningCells(winSequence);
        const winTitle = currentTurn === 1 ? 'Player 1 (Cobalt)' : gameMode === 'vs-cpu' ? '🤖 CPU' : 'Player 2 (Crimson)';
        setStatusMessage(`🎉 ${winTitle} connects 4 and wins!`);
        setGameStatus('finished');
        setIsAnimating(false);

        if (currentTurn === 1) setScoreP1((prev) => prev + 1);
        else setScoreP2((prev) => prev + 1);
        return;
      }

      // Check draw
      if (isBoardFull(newGrid)) {
        setWinner('draw');
        setStatusMessage('Board is full! It is a Draw.');
        setGameStatus('finished');
        setIsAnimating(false);
        return;
      }

      // Advance turn seamlessly without popup interruption
      const nextPlayer: PlayerNumber = currentTurn === 1 ? 2 : 1;
      setTurn(nextPlayer);
      setIsAnimating(false);

      if (gameMode === 'vs-cpu' && nextPlayer === 2) {
        setStatusMessage('🤖 CPU is contemplating next drop...');
      } else {
        setStatusMessage(`Turn: Player ${nextPlayer} (${nextPlayer === 1 ? 'Cobalt' : 'Crimson'})`);
      }
    }, fallDurationMs + 40);
  }, [grid, turn, winner, isAnimating, lastDropPos, statusMessage, gameMode, setGameStatus]);

  const handleColumnClick = useCallback((colIndex: number) => {
    if (winner !== null || isAnimating || isThinking) return;

    // Remote turn check
    if (gameMode === 'remote') {
      const localPlayer = multiplayer.isLocalHost() ? 1 : 2;
      if (turn !== localPlayer) {
        setStatusMessage('Waiting for remote opponent...');
        triggerHaptic('light');
        return;
      }
    }

    // CPU turn lock
    if (gameMode === 'vs-cpu' && turn === 2) return;

    executeDrop(colIndex, false);
  }, [winner, isAnimating, isThinking, gameMode, turn, executeDrop]);

  // Undo Handler
  const handleUndo = useCallback((isRemoteTrigger = false) => {
    if (isAnimating || isThinking || history.length === 0) return;

    triggerHaptic('medium');
    playBounceSound(420);

    if (gameMode === 'vs-cpu') {
      const rollbackSteps = history.length >= 2 ? 2 : 1;
      const targetIndex = history.length - rollbackSteps;
      const targetState = history[targetIndex];

      setGrid(targetState.grid);
      setTurn(targetState.turn);
      setLastDropPos(targetState.lastDropPos);
      setStatusMessage(targetState.statusMessage);
      setHistory((prev) => prev.slice(0, targetIndex));
      setWinner(null);
      setWinningCells([]);
      setGameStatus('active');
    } else {
      const targetIndex = history.length - 1;
      const targetState = history[targetIndex];

      setGrid(targetState.grid);
      setTurn(targetState.turn);
      setLastDropPos(targetState.lastDropPos);
      setStatusMessage(targetState.statusMessage);
      setHistory((prev) => prev.slice(0, targetIndex));
      setWinner(null);
      setWinningCells([]);
      setGameStatus('active');

      if (gameMode === 'remote' && !isRemoteTrigger) {
        multiplayer.send({ type: 'UNDO' });
      }
    }
  }, [isAnimating, isThinking, history, gameMode, setGameStatus]);

  // AI CPU Move Trigger (Web Worker Minimax)
  useEffect(() => {
    if (gameMode !== 'vs-cpu' || turn !== 2 || winner !== null || isAnimating || isThinking) {
      return;
    }

    let cancelled = false;
    setIsThinking(true);
    setIsCpuThinking(true);
    setStatusMessage('🤖 CPU is thinking...');

    const timer = setTimeout(async () => {
      try {
        const bestCol = await requestAIMove<number>('connect-four', grid, 2, 'medium');
        if (!cancelled && bestCol !== null && bestCol !== undefined && bestCol >= 0) {
          setIsThinking(false);
          setIsCpuThinking(false);
          executeDrop(bestCol, false);
        } else if (!cancelled) {
          // Fallback first available column
          const fallbackCol = [3, 2, 4, 1, 5, 0, 6].find((c) => grid[0][c] === 0) ?? 0;
          setIsThinking(false);
          setIsCpuThinking(false);
          executeDrop(fallbackCol, false);
        }
      } catch (err) {
        console.error('CPU Move computation failed:', err);
        if (!cancelled) {
          setIsThinking(false);
          setIsCpuThinking(false);
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsThinking(false);
      setIsCpuThinking(false);
    };
  }, [gameMode, turn, winner, isAnimating, isThinking, grid, executeDrop, setIsCpuThinking]);

  // WebRTC Remote Peer Listener
  useEffect(() => {
    const unbind = multiplayer.onMessage((msg) => {
      if (msg.type === 'MOVE' && typeof msg.payload?.col === 'number') {
        executeDrop(msg.payload.col, true);
      } else if (msg.type === 'RESTART') {
        resetGame(true);
      } else if (msg.type === 'UNDO') {
        handleUndo(true);
      }
    });

    return unbind;
  }, [executeDrop, resetGame, handleUndo]);

  const isWinningCell = (r: number, c: number) => {
    return winningCells.some(([wr, wc]) => wr === r && wc === c);
  };

  const canUndo = history.length > (gameMode === 'vs-cpu' ? 1 : 0) && !isAnimating && !isThinking;

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden">
      <GameHeader
        title="Connect Four"
        subtitle="Vertical 4-In-A-Row"
        turn={turn}
        scoreP1={scoreP1}
        scoreP2={scoreP2}
        p1Label="P1 (Cobalt)"
        p2Label={gameMode === 'vs-cpu' ? '🤖 CPU (Crimson)' : 'P2 (Crimson)'}
        onRestart={() => resetGame(false)}
        statusMessage={statusMessage}
        gameMode={gameMode}
        onToggleGameMode={(m) => {
          setGameMode(m);
          resetGame(false);
        }}
        supportedModes={['pass-and-play', 'vs-cpu', 'remote']}
        onUndo={handleUndo}
        canUndo={canUndo}
        onOpenRemoteModal={() => setShowRemoteModal(true)}
      />

      {/* Main Connect Four Vertical Rack */}
      <main className="flex-1 flex flex-col items-center justify-center p-2.5 sm:p-4 md:p-6">
        {/* Active Player Turn Banner Indicator */}
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg mb-2 flex items-center justify-center">
          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full border shadow-md transition-all duration-300 ${
              turn === 1
                ? 'bg-blue-600/20 border-blue-500/60 text-blue-800 shadow-blue-500/20 ring-2 ring-blue-500/30'
                : 'bg-rose-600/20 border-rose-500/60 text-rose-800 shadow-rose-500/20 ring-2 ring-rose-500/30'
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded-full shadow-sm ${
                isThinking ? 'animate-spin bg-amber-400' : 'animate-pulse'
              } ${
                turn === 1 ? 'bg-player-1 ring-2 ring-blue-300' : 'bg-player-2 ring-2 ring-rose-300'
              }`}
            />
            <span className="text-xs font-black uppercase tracking-wider">
              {winner !== null
                ? 'Game Over'
                : turn === 1
                ? "Player 1's Turn (Cobalt)"
                : gameMode === 'vs-cpu'
                ? isThinking ? 'CPU is calculating...' : "CPU's Turn (Crimson)"
                : "Player 2's Turn (Crimson)"}
            </span>
          </div>
        </div>

        {/* Column Drop Indicator Buttons */}
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg grid grid-cols-7 gap-1.5 sm:gap-2 px-3 mb-1.5">
          {Array.from({ length: COLS }).map((_, col) => {
            const isColFull = grid[0][col] !== 0;
            const isCpuTurn = gameMode === 'vs-cpu' && turn === 2;
            const isDisabled = winner !== null || isColFull || isAnimating || isThinking || isCpuTurn;
            return (
              <button
                key={col}
                type="button"
                onClick={() => handleColumnClick(col)}
                disabled={isDisabled}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
                  !isDisabled
                    ? 'hover:bg-black/10 active:scale-90 cursor-pointer'
                    : 'opacity-30 cursor-not-allowed'
                }`}
                aria-label={`Drop into column ${col + 1}`}
              >
                <div
                  className={`w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full transition-transform ${
                    isDisabled
                      ? 'bg-transparent'
                      : turn === 1
                      ? 'bg-player-1 shadow-sm'
                      : 'bg-player-2 shadow-sm'
                  }`}
                />
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-container-dark/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            );
          })}
        </div>

        {/* The Classic Vertical Blue Grid Board - Molded Matte Plastic with Ribbed Texturing */}
        <div 
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 18px, rgba(255,255,255,0.07) 19px, rgba(0,0,0,0.18) 20px)'
          }}
          className="w-full max-w-sm sm:max-w-md md:max-w-lg bg-gradient-to-b from-[#1d4ed8] via-[#2563eb] to-[#1e40af] rounded-3xl sm:rounded-[36px] p-3 sm:p-5 clubhouse-board-depth table-flat border-t-2 border-white/20 border-b-4 border-black/40 border-x-2 border-blue-800 relative"
        >
          {/* Beveled Plastic Frame Top Highlight */}
          <div className="absolute inset-x-4 top-1 h-1.5 rounded-t-2xl bg-gradient-to-r from-white/10 via-white/30 to-white/10 pointer-events-none" />

          {/* 7x6 Grid Cells */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 z-10 relative">
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const isWin = isWinningCell(r, c);
                const isLast = lastDropPos?.row === r && lastDropPos?.col === c;

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onClick={() => handleColumnClick(c)}
                    disabled={winner !== null || isAnimating || isThinking || (gameMode === 'vs-cpu' && turn === 2)}
                    className="aspect-square rounded-full flex items-center justify-center relative focus:outline-none"
                    aria-label={`Row ${r + 1}, Col ${c + 1}`}
                  >
                    {/* Empty dark recessed hole with physical hollow channel shadow */}
                    <div className="w-full h-full rounded-full bg-[#0b1329] table-recess border border-black/60 flex items-center justify-center overflow-hidden relative shadow-[inset_2px_4px_6px_rgba(0,0,0,0.7),inset_-1px_-1px_2px_rgba(255,255,255,0.2)]">
                      {/* Active Falling Disc in this cell */}
                      {fallingDisc && fallingDisc.row === r && fallingDisc.col === c && (
                        <div
                          className={`w-full h-full rounded-full flex flex-col items-center justify-center clubhouse-piece-shadow animate-disc-fall absolute inset-0 z-20 shadow-md ${
                            fallingDisc.player === 1
                              ? 'bg-gradient-to-br from-[#60a5fa] via-[#2563eb] to-[#1e3a8a] border-2 border-[#93c5fd]'
                              : 'bg-gradient-to-br from-[#fb7185] via-[#e11d48] to-[#881337] border-2 border-[#fecdd3]'
                          }`}
                          style={{
                            '--tw-drop-start': `-${(r + 1) * 48 + 36}px`,
                            '--tw-fall-duration': `${fallingDisc.durationMs}ms`,
                          } as React.CSSProperties}
                        >
                          {/* Glossy top-edge rim */}
                          <div className="w-[75%] h-[28%] rounded-full bg-gradient-to-b from-white/60 to-transparent absolute top-0.5 pointer-events-none" />
                          {/* Concentric ridge ring */}
                          <div className="w-[66%] h-[66%] rounded-full border border-white/30 shadow-inner flex items-center justify-center">
                            {/* Sunken center square */}
                            <div className="w-[45%] h-[45%] rounded-xs bg-black/20 border border-white/25 shadow-inner" />
                          </div>
                        </div>
                      )}

                      {/* Settled placed piece styled like tournament checker */}
                      {cell !== 0 && (
                        <div
                          className={`w-full h-full rounded-full flex flex-col items-center justify-center clubhouse-piece-shadow transition-all relative ${
                            cell === 1
                              ? 'bg-gradient-to-br from-[#60a5fa] via-[#2563eb] to-[#1e3a8a] border-2 border-[#93c5fd]'
                              : 'bg-gradient-to-br from-[#fb7185] via-[#e11d48] to-[#881337] border-2 border-[#fecdd3]'
                          } ${isWin ? 'ring-4 ring-yellow-300 animate-bounce' : isLast ? 'ring-2 ring-white/70' : ''}`}
                        >
                          {/* Glossy top-edge rim */}
                          <div className="w-[75%] h-[28%] rounded-full bg-gradient-to-b from-white/60 to-transparent absolute top-0.5 pointer-events-none" />
                          {/* Concentric ridge ring */}
                          <div className="w-[66%] h-[66%] rounded-full border border-white/30 shadow-inner flex items-center justify-center">
                            {/* Sunken center square */}
                            <div className="w-[45%] h-[45%] rounded-xs bg-black/20 border border-white/25 shadow-inner" />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Molded Base Stand Feet with bevels */}
          <div className="absolute -bottom-3.5 left-4 w-9 h-5 bg-gradient-to-b from-[#1e3a8a] to-[#0f172a] rounded-b-xl shadow-xl border-t border-white/20 border-b border-black/80" />
          <div className="absolute -bottom-3.5 right-4 w-9 h-5 bg-gradient-to-b from-[#1e3a8a] to-[#0f172a] rounded-b-xl shadow-xl border-t border-white/20 border-b border-black/80" />
        </div>
      </main>

      {/* Footer Instructions */}
      <footer className="pb-safe px-4 py-2 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>Tap any column to drop a piece</span>
        <span className="text-[11px] bg-accent-light px-2.5 py-1 rounded-full border border-[#d8c3a5]/50">
          Target: 4 in a line
        </span>
      </footer>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Connect Four"
          stats={[
            {
              label: 'Match Record',
              p1Value: `${scoreP1} ${scoreP1 === 1 ? 'Win' : 'Wins'}`,
              p2Value: `${scoreP2} ${scoreP2 === 1 ? 'Win' : 'Wins'}`,
            },
            {
              label: 'Winning Line',
              p1Value: winner === 1 ? '4 Connected' : '-',
              p2Value: winner === 2 ? '4 Connected' : '-',
            },
          ]}
          onRestart={() => resetGame(false)}
          onMenu={resetToMenu}
        />
      )}

      {/* WebRTC Remote Duel Modal */}
      <RemoteDuelModal
        isOpen={showRemoteModal}
        onClose={() => setShowRemoteModal(false)}
      />
    </div>
  );
};
