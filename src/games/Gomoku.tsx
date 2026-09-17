import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { GameHeader, type GamePlayMode } from '../components/GameHeader';
import { GameOverModal } from '../components/GameOverModal';
import { RemoteDuelModal } from '../components/RemoteDuelModal';
import type { PlayerNumber } from '../types/game';
import { triggerHaptic, playCaptureSound, playWoodClackSound } from '../utils/feedback';
import { requestAIMove } from '../utils/aiClient';
import { multiplayer } from '../utils/multiplayer';

const BOARD_SIZE = 15;
type CellValue = 0 | 1 | 2; // 0 = empty, 1 = P1 (Black), 2 = P2 (White)

interface GomokuSnapshot {
  grid: CellValue[][];
  turn: PlayerNumber;
  lastMove: [number, number] | null;
  statusMessage: string;
}

export const Gomoku: React.FC = () => {
  const { setGameStatus, resetToMenu } = useGame();

  const [grid, setGrid] = useState<CellValue[][]>(() =>
    Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0))
  );
  const [turn, setTurn] = useState<PlayerNumber>(1); // P1 Black starts
  const [winner, setWinner] = useState<PlayerNumber | 'draw' | null>(null);
  const [winningLine, setWinningLine] = useState<[number, number][]>([]);
  const [hoverPos, setHoverPos] = useState<[number, number] | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Player 1 (Black): Tap an intersection to place stone');
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [isThinking, setIsThinking] = useState<boolean>(false);

  // Modes & Multiplayer
  const [gameMode, setGameMode] = useState<GamePlayMode>('pass-and-play');
  const [showRemoteModal, setShowRemoteModal] = useState<boolean>(false);

  // History stack for Undo
  const [history, setHistory] = useState<GomokuSnapshot[]>([]);

  // Score match counts
  const [scoreP1, setScoreP1] = useState<number>(0);
  const [scoreP2, setScoreP2] = useState<number>(0);

  const resetGame = useCallback((isRemote = false) => {
    setGrid(Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)));
    setTurn(1);
    setWinner(null);
    setWinningLine([]);
    setHoverPos(null);
    setLastMove(null);
    setIsThinking(false);
    setHistory([]);
    setStatusMessage('Player 1 (Black): Tap an intersection to place stone');
    setGameStatus('active');

    if (gameMode === 'remote' && !isRemote) {
      multiplayer.send({ type: 'RESTART' });
    }
  }, [gameMode, setGameStatus]);

  // Check 5 consecutive stones in 4 vectors
  const checkWinAt = (board: CellValue[][], r: number, c: number, player: CellValue): [number, number][] | null => {
    const directions = [
      [0, 1],  // Horizontal -
      [1, 0],  // Vertical |
      [1, 1],  // Diagonal \
      [1, -1], // Diagonal /
    ];

    for (const [dr, dc] of directions) {
      const line: [number, number][] = [[r, c]];

      // Forward direction
      let step = 1;
      while (true) {
        const nr = r + dr * step;
        const nc = c + dc * step;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
          line.push([nr, nc]);
          step++;
        } else {
          break;
        }
      }

      // Backward direction
      step = 1;
      while (true) {
        const nr = r - dr * step;
        const nc = c - dc * step;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
          line.push([nr, nc]);
          step++;
        } else {
          break;
        }
      }

      // 5 or more in a row wins!
      if (line.length >= 5) {
        return line;
      }
    }

    return null;
  };

  const executeStonePlacement = useCallback((r: number, c: number, isRemote = false) => {
    if (winner !== null || grid[r][c] !== 0) return;

    // Push snapshot to history
    setHistory((prev) => [...prev, { grid, turn, lastMove, statusMessage }]);

    if (gameMode === 'remote' && !isRemote) {
      multiplayer.send({ type: 'MOVE', payload: { r, c } });
    }

    triggerHaptic('medium');
    playWoodClackSound();

    const nextGrid = grid.map((row) => [...row]);
    nextGrid[r][c] = turn;
    setGrid(nextGrid);
    setLastMove([r, c]);

    // Check Win
    const winSequence = checkWinAt(nextGrid, r, c, turn);
    if (winSequence) {
      playCaptureSound();
      setWinner(turn);
      setWinningLine(winSequence);
      const winnerName = turn === 1 ? 'Player 1 (Black)' : gameMode === 'vs-cpu' ? '🤖 CPU (White)' : 'Player 2 (White)';
      setStatusMessage(`🎉 ${winnerName} connects 5 and wins!`);
      setGameStatus('finished');

      if (turn === 1) setScoreP1((prev) => prev + 1);
      else setScoreP2((prev) => prev + 1);
      return;
    }

    // Check Draw (Board full)
    const isFull = nextGrid.every((row) => row.every((cell) => cell !== 0));
    if (isFull) {
      setWinner('draw');
      setStatusMessage('Full board! The match ends in a draw.');
      setGameStatus('finished');
      return;
    }

    // Advance turn
    const nextPlayer: PlayerNumber = turn === 1 ? 2 : 1;
    setTurn(nextPlayer);

    if (gameMode === 'vs-cpu' && nextPlayer === 2) {
      setStatusMessage('🤖 CPU is scanning threat vectors...');
    } else {
      setStatusMessage(`Player ${nextPlayer} (${nextPlayer === 1 ? 'Black' : 'White'}): Tap an intersection to place stone`);
    }
  }, [grid, turn, winner, lastMove, statusMessage, gameMode, setGameStatus]);

  const handleIntersectionClick = useCallback((r: number, c: number) => {
    if (winner !== null || isThinking) return;

    if (gameMode === 'remote') {
      const localPlayer = multiplayer.isLocalHost() ? 1 : 2;
      if (turn !== localPlayer) {
        setStatusMessage('Waiting for remote opponent...');
        triggerHaptic('light');
        return;
      }
    }

    if (gameMode === 'vs-cpu' && turn === 2) return;

    if (grid[r][c] !== 0) {
      triggerHaptic('light');
      setStatusMessage('Intersection already occupied!');
      return;
    }

    executeStonePlacement(r, c, false);
  }, [winner, isThinking, gameMode, turn, grid, executeStonePlacement]);

  // Undo Handler
  const handleUndo = useCallback((isRemoteTrigger = false) => {
    if (isThinking || history.length === 0) return;

    triggerHaptic('medium');
    playWoodClackSound();

    if (gameMode === 'vs-cpu') {
      const rollbackSteps = history.length >= 2 ? 2 : 1;
      const targetIndex = history.length - rollbackSteps;
      const targetState = history[targetIndex];

      setGrid(targetState.grid);
      setTurn(targetState.turn);
      setLastMove(targetState.lastMove);
      setStatusMessage(targetState.statusMessage);
      setWinner(null);
      setWinningLine([]);
      setHistory((prev) => prev.slice(0, targetIndex));
      setGameStatus('active');
    } else {
      const targetIndex = history.length - 1;
      const targetState = history[targetIndex];

      setGrid(targetState.grid);
      setTurn(targetState.turn);
      setLastMove(targetState.lastMove);
      setStatusMessage(targetState.statusMessage);
      setWinner(null);
      setWinningLine([]);
      setHistory((prev) => prev.slice(0, targetIndex));
      setGameStatus('active');

      if (gameMode === 'remote' && !isRemoteTrigger) {
        multiplayer.send({ type: 'UNDO' });
      }
    }
  }, [isThinking, history, gameMode, setGameStatus]);

  // AI CPU Move Trigger (Web Worker Threat-Space Minimax)
  useEffect(() => {
    if (gameMode !== 'vs-cpu' || turn !== 2 || winner !== null || isThinking) {
      return;
    }

    let cancelled = false;
    setIsThinking(true);
    setStatusMessage('🤖 CPU is thinking...');

    const timer = setTimeout(async () => {
      try {
        const move = await requestAIMove<[number, number]>('gomoku', grid, 2);
        if (!cancelled && move && Array.isArray(move) && move.length === 2) {
          setIsThinking(false);
          executeStonePlacement(move[0], move[1], false);
        } else if (!cancelled) {
          setIsThinking(false);
        }
      } catch (err) {
        console.error('Gomoku CPU move calculation failed:', err);
        if (!cancelled) setIsThinking(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsThinking(false);
    };
  }, [gameMode, turn, winner, grid, executeStonePlacement]);

  // WebRTC Remote Peer Listener
  useEffect(() => {
    const unbind = multiplayer.onMessage((msg) => {
      if (msg.type === 'MOVE' && msg.payload && typeof msg.payload.r === 'number' && typeof msg.payload.c === 'number') {
        executeStonePlacement(msg.payload.r, msg.payload.c, true);
      } else if (msg.type === 'RESTART') {
        resetGame(true);
      } else if (msg.type === 'UNDO') {
        handleUndo(true);
      }
    });

    return unbind;
  }, [executeStonePlacement, resetGame, handleUndo]);

  // Visual star points (hoshi) on 15x15 board: (3,3), (3,11), (7,7), (11,3), (11,11)
  const isStarPoint = (r: number, c: number) => {
    return (
      (r === 3 && c === 3) ||
      (r === 3 && c === 11) ||
      (r === 7 && c === 7) ||
      (r === 11 && c === 3) ||
      (r === 11 && c === 11)
    );
  };

  const isWinningStone = (r: number, c: number) => {
    return winningLine.some(([wr, wc]) => wr === r && wc === c);
  };

  // 15 coordinates normalized to SVG 0..300 range
  const step = 300 / 16;
  const coords = useMemo(() => {
    return Array.from({ length: BOARD_SIZE }, (_, i) => (i + 1) * step);
  }, [step]);

  const canUndo = history.length > (gameMode === 'vs-cpu' ? 1 : 0) && !isThinking;

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden relative select-none">
      <GameHeader
        title="Gomoku"
        subtitle="Five in a Row"
        turn={turn}
        scoreP1={scoreP1}
        scoreP2={scoreP2}
        p1Label="P1 (Black)"
        p2Label={gameMode === 'vs-cpu' ? '🤖 CPU (White)' : 'P2 (White)'}
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

      {/* Main Bamboo Board Area - Responsive on iPhone, iPad, PC */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 relative touch-none overflow-hidden">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-xl aspect-square max-h-[72vh] bg-[#c48d4c] rounded-3xl sm:rounded-[40px] p-2.5 sm:p-4 clubhouse-board-depth table-flat border-4 sm:border-6 border-[#783e18] flex items-center justify-center relative">
          {/* Authentic Honey Bamboo Surface with Grain & Bevel */}
          <div 
            style={{ 
              background: 'linear-gradient(135deg, #deb887 0%, #d4a770 50%, #c9985d 100%)' 
            }}
            className="w-full h-full rounded-2xl sm:rounded-3xl shadow-inner border border-[#9a5b23]/60 relative overflow-hidden flex items-center justify-center"
          >
            <svg viewBox="0 0 300 300" className="w-full h-full select-none">
              <defs>
                {/* Black Stone: Deep matte obsidian with subtle off-center crescent sheen */}
                <radialGradient id="slateStoneGrad" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#4a4a4a" />
                  <stop offset="70%" stopColor="#1a1a1a" />
                  <stop offset="100%" stopColor="#000000" />
                </radialGradient>
                {/* White Stone: Polished chalk/shell sheen */}
                <radialGradient id="shellStoneGrad" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="75%" stopColor="#f0ede6" />
                  <stop offset="100%" stopColor="#d4cec3" />
                </radialGradient>
              </defs>

              {/* 1. Razor-sharp 1px dark umber Grid Lines */}
              {coords.map((pos, idx) => (
                <React.Fragment key={idx}>
                  {/* Horizontal line */}
                  <line
                    x1={coords[0]}
                    y1={pos}
                    x2={coords[BOARD_SIZE - 1]}
                    y2={pos}
                    stroke="#5c2c16"
                    strokeWidth="1"
                  />
                  {/* Vertical line */}
                  <line
                    x1={pos}
                    y1={coords[0]}
                    x2={pos}
                    y2={coords[BOARD_SIZE - 1]}
                    stroke="#5c2c16"
                    strokeWidth="1"
                  />
                </React.Fragment>
              ))}

              {/* 2. Star Points (Hoshi) */}
              {coords.map((y, r) =>
                coords.map((x, c) => {
                  if (!isStarPoint(r, c)) return null;
                  return (
                    <circle
                      key={`star-${r}-${c}`}
                      cx={x}
                      cy={y}
                      r="2.6"
                      fill="#5c2c16"
                    />
                  );
                })
              )}

              {/* 3. Winning Line Connection Beam */}
              {winningLine.length >= 2 && (
                <line
                  x1={coords[winningLine[0][1]]}
                  y1={coords[winningLine[0][0]]}
                  x2={coords[winningLine[winningLine.length - 1][1]]}
                  y2={coords[winningLine[winningLine.length - 1][0]]}
                  stroke="#ef4444"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  className="animate-pulse"
                />
              )}

              {/* 4. Placed Stones & Touch Targets */}
              {coords.map((y, r) =>
                coords.map((x, c) => {
                  const val = grid[r][c];
                  const isWin = isWinningStone(r, c);
                  const isHover = hoverPos && hoverPos[0] === r && hoverPos[1] === c && val === 0;

                  return (
                    <g key={`cell-${r}-${c}`}>
                      {/* Generous touch hitbox for finger taps on small intersections */}
                      <rect
                        x={x - step / 2}
                        y={y - step / 2}
                        width={step}
                        height={step}
                        fill="transparent"
                        className="cursor-pointer"
                        onClick={() => handleIntersectionClick(r, c)}
                        onMouseEnter={() => setHoverPos([r, c])}
                        onMouseLeave={() => setHoverPos(null)}
                      />

                      {/* Placement Preview Dot on touch/hover */}
                      {isHover && winner === null && (
                        <circle
                          cx={x}
                          cy={y}
                          r={step * 0.42}
                          fill={turn === 1 ? '#0f172a' : '#ffffff'}
                          fillOpacity="0.4"
                          className="pointer-events-none animate-pulse"
                        />
                      )}

                      {/* Placed Yunzi Stone */}
                      {val !== 0 && (
                        <g className="pointer-events-none transition-spring">
                          {/* Soft contact shadow offset toward bottom-right */}
                          <circle
                            cx={x + 1.8}
                            cy={y + 2.2}
                            r={step * 0.44}
                            fill="rgba(0, 0, 0, 0.42)"
                          />
                          {/* Stone body with biconvex gradient */}
                          <circle
                            cx={x}
                            cy={y}
                            r={step * 0.44}
                            fill={val === 1 ? 'url(#slateStoneGrad)' : 'url(#shellStoneGrad)'}
                            stroke={val === 1 ? '#262626' : '#cbd5e1'}
                            strokeWidth="0.8"
                            className={isWin ? 'ring-2 ring-yellow-400 animate-bounce' : ''}
                          />
                          {/* Delicate off-center crescent reflection */}
                          <circle
                            cx={x - step * 0.12}
                            cy={y - step * 0.12}
                            r={step * 0.16}
                            fill="#ffffff"
                            fillOpacity={val === 1 ? '0.18' : '0.65'}
                          />
                          {/* Subtle last-move indicator dot */}
                          {lastMove && lastMove[0] === r && lastMove[1] === c && !isWin && (
                            <circle
                              cx={x}
                              cy={y}
                              r={step * 0.12}
                              fill="#ef4444"
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
          </div>
        </div>
      </main>

      {/* Footer Instructions */}
      <footer className="pb-safe px-4 py-1.5 border-t border-[#2a2e33]/10 bg-[#f3e9dc]/80 backdrop-blur-sm flex items-center justify-between text-xs font-semibold text-[#7d6753]">
        <span>Tap any grid intersection to place a stone</span>
        <span className="text-[11px] bg-accent-light px-2.5 py-0.5 rounded-full border border-[#d8c3a5]/50">
          Target: 5 in a row
        </span>
      </footer>

      {/* Victory Game Over Modal */}
      {winner !== null && (
        <GameOverModal
          winner={winner}
          gameName="Gomoku"
          stats={[
            {
              label: 'Match Wins',
              p1Value: `${scoreP1} Wins`,
              p2Value: `${scoreP2} Wins`,
            },
            {
              label: 'Winning Alignment',
              p1Value: winner === 1 ? '5-in-a-Row' : '-',
              p2Value: winner === 2 ? '5-in-a-Row' : '-',
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
