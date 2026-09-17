import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playGlassTinkSound, playVictorySound } from '../utils/feedback';
import { getHexAIMove } from '../utils/gameAi';

const BOARD_SIZE = 11;
const HEX_RADIUS = 15.5;
const HEX_WIDTH = Math.sqrt(3) * HEX_RADIUS; // ~26.85
const ROW_STEP = HEX_RADIUS * 1.5; // ~23.25

type CellState = PlayerNumber | null;

export const Hex: React.FC = () => {
  const { setGameStatus, resetToMenu, gameMode, isCpuThinking, setIsCpuThinking } = useGame();

  const [board, setBoard] = useState<CellState[][]>(() =>
    Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null))
  );
  const [turn, setTurn] = useState<PlayerNumber>(1);
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [winningPath, setWinningPath] = useState<{ r: number; c: number }[]>([]);
  const [lastMove, setLastMove] = useState<{ r: number; c: number } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ r: number; c: number } | null>(null);
  const [moveCount, setMoveCount] = useState<number>(0);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // SVG dimensions & offsets
  const svgWidth = 515;
  const svgHeight = 335;
  const startX = 55;
  const startY = 48;

  // Hex Neighbors in 11x11 Rhombic Grid
  const getNeighbors = (r: number, c: number): [number, number][] => {
    const deltas: [number, number][] = [
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
    ];
    const neighbors: [number, number][] = [];
    for (const [dr, dc] of deltas) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        neighbors.push([nr, nc]);
      }
    }
    return neighbors;
  };

  // Breadth-First Search (BFS) to detect unbroken connected path across borders
  const checkWinBFS = useCallback(
    (currentBoard: CellState[][], player: PlayerNumber): { r: number; c: number }[] | null => {
      const visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
      const parent = new Map<string, string | null>();
      const queue: [number, number][] = [];

      if (player === 1) {
        // Player 1 (Blue) connects Top (r = 0) to Bottom (r = BOARD_SIZE - 1)
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (currentBoard[0][c] === 1) {
            queue.push([0, c]);
            visited[0][c] = true;
            parent.set(`0,${c}`, null);
          }
        }

        while (queue.length > 0) {
          const [r, c] = queue.shift()!;
          if (r === BOARD_SIZE - 1) {
            const path: { r: number; c: number }[] = [];
            let currKey: string | null = `${r},${c}`;
            while (currKey !== null) {
              const [pr, pc] = currKey.split(',').map(Number);
              path.push({ r: pr, c: pc });
              currKey = parent.get(currKey) ?? null;
            }
            return path;
          }

          for (const [nr, nc] of getNeighbors(r, c)) {
            if (!visited[nr][nc] && currentBoard[nr][nc] === 1) {
              visited[nr][nc] = true;
              parent.set(`${nr},${nc}`, `${r},${c}`);
              queue.push([nr, nc]);
            }
          }
        }
      } else {
        // Player 2 (Red) connects Left (c = 0) to Right (c = BOARD_SIZE - 1)
        for (let r = 0; r < BOARD_SIZE; r++) {
          if (currentBoard[r][0] === 2) {
            queue.push([r, 0]);
            visited[r][0] = true;
            parent.set(`${r},0`, null);
          }
        }

        while (queue.length > 0) {
          const [r, c] = queue.shift()!;
          if (c === BOARD_SIZE - 1) {
            const path: { r: number; c: number }[] = [];
            let currKey: string | null = `${r},${c}`;
            while (currKey !== null) {
              const [pr, pc] = currKey.split(',').map(Number);
              path.push({ r: pr, c: pc });
              currKey = parent.get(currKey) ?? null;
            }
            return path;
          }

          for (const [nr, nc] of getNeighbors(r, c)) {
            if (!visited[nr][nc] && currentBoard[nr][nc] === 2) {
              visited[nr][nc] = true;
              parent.set(`${nr},${nc}`, `${r},${c}`);
              queue.push([nr, nc]);
            }
          }
        }
      }

      return null;
    },
    []
  );

  // Commit a move
  const commitMove = useCallback(
    (r: number, c: number) => {
      if (winner !== null || board[r][c] !== null) return;

      triggerHaptic('medium');
      playGlassTinkSound();

      const newBoard = board.map((row) => [...row]);
      newBoard[r][c] = turn;
      setBoard(newBoard);
      setLastMove({ r, c });
      setPendingMove(null);
      setMoveCount((prev) => prev + 1);

      // Pathfinding Check
      const winPath = checkWinBFS(newBoard, turn);
      if (winPath) {
        setWinner(turn);
        setWinningPath(winPath);
        triggerHaptic('success');
        playVictorySound();
        setGameStatus('finished');
      } else {
        const nextTurn: PlayerNumber = turn === 1 ? 2 : 1;
        setTurn(nextTurn);
        setGameStatus('active');
      }
    },
    [board, turn, winner, checkWinBFS, setGameStatus]
  );

  // Two-Stage Selection or Immediate Commit
  const handleHexSelected = (r: number, c: number) => {
    if (winner !== null || board[r][c] !== null) return;
    if (gameMode === 'pve' && turn === 2) return;
    if (isCpuThinking) return;

    // If tapping the already selected pending hex, confirm and play!
    if (pendingMove?.r === r && pendingMove?.c === c) {
      commitMove(r, c);
      return;
    }

    // Otherwise select the hex for preview
    setPendingMove({ r, c });
    playGlassTinkSound();
    triggerHaptic('light');
  };

  // Voronoi nearest-neighbor hit detection on SVG container
  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (winner !== null) return;
    if (gameMode === 'pve' && turn === 2) return;
    if (isCpuThinking) return;

    const svg = svgRef.current;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());

    let minDist = Infinity;
    let nearest: { r: number; c: number } | null = null;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cx = startX + (c + r * 0.5) * HEX_WIDTH;
        const cy = startY + r * ROW_STEP;
        const dist = Math.hypot(svgPt.x - cx, svgPt.y - cy);
        if (dist < minDist) {
          minDist = dist;
          nearest = { r, c };
        }
      }
    }

    if (nearest && minDist <= HEX_RADIUS * 1.25) {
      handleHexSelected(nearest.r, nearest.c);
    }
  };

  // Non-blocking CPU AI Loop
  useEffect(() => {
    if (gameMode !== 'pve' || turn !== 2 || winner !== null) return;

    setIsCpuThinking(true);
    setPendingMove(null);

    const timer = setTimeout(() => {
      setIsCpuThinking(false);
      const aiMove = getHexAIMove(board, 2);
      if (aiMove) {
        commitMove(aiMove.r, aiMove.c);
      }
    }, 850);

    return () => {
      clearTimeout(timer);
      setIsCpuThinking(false);
    };
  }, [gameMode, turn, winner, board, commitMove, setIsCpuThinking]);

  const handleRestart = () => {
    setBoard(Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null)));
    setTurn(1);
    setWinner(null);
    setWinningPath([]);
    setLastMove(null);
    setPendingMove(null);
    setMoveCount(0);
    setGameStatus('active');
  };

  // Hexagon corner points generator
  const getHexPoints = (cx: number, cy: number, r: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i + 30);
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      points.push(`${px.toFixed(2)},${py.toFixed(2)}`);
    }
    return points.join(' ');
  };

  const isCpuTurn = gameMode === 'pve' && turn === 2;

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden select-none">
      <GameHeader
        gameId="hex"
        gameName="Hex"
        turn={turn}
        onRestart={handleRestart}
        statusMessage={
          winner !== null
            ? `Player ${winner} formed an unbroken chain! Victory!`
            : pendingMove
            ? `Selected hex (${pendingMove.r + 1}, ${pendingMove.c + 1}) — Tap Confirm or tap again to place`
            : `Move ${moveCount + 1}: Tap any vacant hex to target your acrylic gem`
        }
      />

      {/* Main Board Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden relative">
        {/* Objective & Edge Legend Indicator */}
        <div className="w-full max-w-sm flex items-center justify-between px-3 py-1.5 bg-container-dark/95 border border-[#3e444c] rounded-2xl shadow-xl mb-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-blue-500 shadow-sm inline-block" />
            <span className="font-bold text-blue-300">P1: Top ⇄ Bottom</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-red-300">
              {gameMode === 'pve' ? 'CPU: Left ⇄ Right' : 'P2: Left ⇄ Right'}
            </span>
            <span className="w-3 h-3 rounded-md bg-red-500 shadow-sm inline-block" />
          </div>
        </div>

        {/* 11x11 Rhombic Board in Mahogany Wood Frame */}
        <div className="relative flex items-center justify-center max-h-[74vh] w-full max-w-2xl aspect-[515/335] clubhouse-board-depth table-flat rounded-3xl overflow-hidden shadow-2xl border-4 border-[#3e2312] bg-[#29170a]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            onPointerDown={handleSvgPointerDown}
            className="w-full h-full touch-none select-none cursor-pointer"
          >
            <defs>
              {/* Wood Grain Texture Pattern */}
              <linearGradient id="boardWood" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#45230c" />
                <stop offset="50%" stopColor="#2e1607" />
                <stop offset="100%" stopColor="#45230c" />
              </linearGradient>

              {/* Sapphire Gem Gradient (Player 1 Blue) */}
              <radialGradient id="sapphireGem" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="35%" stopColor="#3b82f6" />
                <stop offset="85%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#0f172a" />
              </radialGradient>

              {/* Ruby Gem Gradient (Player 2 Red) */}
              <radialGradient id="rubyGem" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#fca5a5" />
                <stop offset="35%" stopColor="#ef4444" />
                <stop offset="85%" stopColor="#b91c1c" />
                <stop offset="100%" stopColor="#450a0a" />
              </radialGradient>

              {/* Glow Filter for Winning Chain */}
              <filter id="winGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Board Plate */}
            <rect width={svgWidth} height={svgHeight} fill="url(#boardWood)" />

            {/* Board Border Rails */}
            {/* Top Border (Blue for P1) */}
            <line
              x1={startX - 16}
              y1={startY - 16}
              x2={startX + 10 * HEX_WIDTH + 16}
              y2={startY - 16}
              stroke="#2563eb"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Bottom Border (Blue for P1) */}
            <line
              x1={startX + 5 * HEX_WIDTH - 16}
              y1={startY + 10 * ROW_STEP + 16}
              x2={startX + 15 * HEX_WIDTH + 16}
              y2={startY + 10 * ROW_STEP + 16}
              stroke="#2563eb"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Left Border (Red for P2) */}
            <line
              x1={startX - 16}
              y1={startY - 14}
              x2={startX + 5 * HEX_WIDTH - 16}
              y2={startY + 10 * ROW_STEP + 14}
              stroke="#dc2626"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Right Border (Red for P2) */}
            <line
              x1={startX + 10 * HEX_WIDTH + 16}
              y1={startY - 14}
              x2={startX + 15 * HEX_WIDTH + 16}
              y2={startY + 10 * ROW_STEP + 14}
              stroke="#dc2626"
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Hexagonal Cells */}
            {board.map((row, r) =>
              row.map((cell, c) => {
                const cx = startX + (c + r * 0.5) * HEX_WIDTH;
                const cy = startY + r * ROW_STEP;
                const isWinningCell = winningPath.some((p) => p.r === r && p.c === c);
                const isLast = lastMove?.r === r && lastMove?.c === c;
                const isPending = pendingMove?.r === r && pendingMove?.c === c;

                return (
                  <g key={`${r}-${c}`}>
                    {/* Carved Wood Recess */}
                    <polygon
                      points={getHexPoints(cx, cy, HEX_RADIUS)}
                      fill="#1a0c04"
                      stroke="#422008"
                      strokeWidth="1.2"
                    />

                    {/* Subtle Bevel Inner Ring */}
                    <polygon
                      points={getHexPoints(cx, cy, HEX_RADIUS - 2)}
                      fill="#251206"
                      opacity="0.75"
                    />

                    {/* Vacant Hover Highlight */}
                    {cell === null && winner === null && (
                      <polygon
                        points={getHexPoints(cx, cy, HEX_RADIUS - 3)}
                        fill="transparent"
                        className="hover:fill-white/10"
                      />
                    )}

                    {/* Pending Two-Stage Halo & Preview Gem */}
                    {isPending && cell === null && (
                      <g className="animate-fade-in pointer-events-none">
                        <polygon
                          points={getHexPoints(cx, cy, HEX_RADIUS + 1)}
                          fill="none"
                          stroke={turn === 1 ? '#60a5fa' : '#f87171'}
                          strokeWidth="2.5"
                          className="animate-pulse"
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={HEX_RADIUS - 3}
                          fill={turn === 1 ? 'url(#sapphireGem)' : 'url(#rubyGem)'}
                          opacity="0.65"
                          stroke="#fef08a"
                          strokeWidth="1.5"
                          strokeDasharray="3 2"
                        />
                      </g>
                    )}

                    {/* Acrylic Gem (Cobalt Blue Sapphire or Crimson Red Ruby) */}
                    {cell !== null && (
                      <g filter={isWinningCell ? 'url(#winGlow)' : undefined}>
                        {/* Drop shadow */}
                        <circle
                          cx={cx + 1}
                          cy={cy + 2}
                          r={HEX_RADIUS - 3.5}
                          fill="rgba(0,0,0,0.5)"
                        />
                        {/* Gem Body */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={HEX_RADIUS - 3}
                          fill={cell === 1 ? 'url(#sapphireGem)' : 'url(#rubyGem)'}
                          stroke={cell === 1 ? '#60a5fa' : '#f87171'}
                          strokeWidth="1"
                        />
                        {/* Specular Highlight Dot */}
                        <ellipse
                          cx={cx - 3}
                          cy={cy - 3}
                          rx="2.5"
                          ry="1.5"
                          fill="rgba(255, 255, 255, 0.75)"
                        />

                        {/* Last move golden ring indicator */}
                        {isLast && !isWinningCell && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={HEX_RADIUS - 2}
                            fill="none"
                            stroke="#fef08a"
                            strokeWidth="1.8"
                            strokeDasharray="3 2"
                            className="animate-pulse"
                          />
                        )}

                        {/* Winning Path Ring */}
                        {isWinningCell && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={HEX_RADIUS - 1.5}
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth="2.2"
                            className="animate-pulse"
                          />
                        )}
                      </g>
                    )}
                  </g>
                );
              })
            )}
          </svg>

          {/* Two-Stage Touch & Confirm Floating Action Pill */}
          {pendingMove && winner === null && !isCpuTurn && (
            <div className="absolute bottom-3 z-30 flex items-center gap-2 sm:gap-3 bg-slate-950/90 backdrop-blur-md px-4 py-2 rounded-full border border-amber-400/70 shadow-2xl animate-fade-in">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <span
                  className="w-3 h-3 rounded-full shadow-sm inline-block"
                  style={{ backgroundColor: turn === 1 ? '#3b82f6' : '#ef4444' }}
                />
                <span>Cell ({pendingMove.r + 1}, {pendingMove.c + 1})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  commitMove(pendingMove.r, pendingMove.c);
                }}
                className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-stone-950 font-black text-xs uppercase tracking-wider shadow-md flex items-center gap-1 cursor-pointer transition-all"
              >
                <span>✓</span>
                <span>Confirm</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingMove(null)}
                className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Hex"
          stats={[
            {
              label: 'Total Moves',
              p1Value: `${moveCount} turns played`,
              p2Value: `${moveCount} turns played`,
            },
            {
              label: 'Winning Path',
              p1Value: winner === 1 ? `${winningPath.length} gems connected` : '-',
              p2Value: winner === 2 ? `${winningPath.length} gems connected` : '-',
            },
          ]}
          onRestart={handleRestart}
          onMenu={resetToMenu}
        />
      )}
    </div>
  );
};

export default Hex;
